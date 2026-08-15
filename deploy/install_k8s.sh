#!/usr/bin/env bash
# Builds Docker images and deploys the application into Kubernetes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SUDO=""

if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "sudo is required to install missing dependencies." >&2
  fi
fi

export NAMESPACE="${NAMESPACE:-book-read}"
export DOMAIN="${DOMAIN:-23.26.124.71}"
export VITE_API_URL="${VITE_API_URL:-/api/v1}"
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"
export POSTGRES_DB="${POSTGRES_DB:-library}"
export POSTGRES_USER="${POSTGRES_USER:-library}"
# Пароль БД значения по умолчанию не имеет: он берётся из кластера или генерируется ниже.
export DB_STORAGE_SIZE="${DB_STORAGE_SIZE:-1Gi}"
export COVERS_STORAGE_SIZE="${COVERS_STORAGE_SIZE:-1Gi}"
# Одна реплика: обложки лежат на диске бэкенда (storage.type=filesystem) на томе ReadWriteOnce.
# Масштабировать бэкенд можно только вместе с общим хранилищем — STORAGE_TYPE=s3.
export BACKEND_REPLICAS="${BACKEND_REPLICAS:-1}"
export FRONTEND_REPLICAS="${FRONTEND_REPLICAS:-1}"
export FRONTEND_SERVICE_TYPE="${FRONTEND_SERVICE_TYPE:-ClusterIP}"
export IMAGE_TAG="${IMAGE_TAG:-local}"
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"
export ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-180s}"
export SECURITY_COOKIE_SECURE="${SECURITY_COOKIE_SECURE:-true}"

export BACKEND_IMAGE="${IMAGE_REGISTRY:+${IMAGE_REGISTRY}/}book-read-backend:${IMAGE_TAG}"
export FRONTEND_IMAGE="${IMAGE_REGISTRY:+${IMAGE_REGISTRY}/}book-read-frontend:${IMAGE_TAG}"
# Без реестра образы собираются на месте и тянуть их неоткуда; kubelet сам выбрал бы Always
# для тега latest и уронил бы под на ErrImagePull.
if [[ -z "${IMAGE_PULL_POLICY:-}" ]]; then
  if [[ -n "${IMAGE_REGISTRY}" ]]; then
    IMAGE_PULL_POLICY="Always"
  else
    IMAGE_PULL_POLICY="IfNotPresent"
  fi
fi
export IMAGE_PULL_POLICY

ensure_command() {
  local cmd="$1"
  local pkg="$2"

  if command -v "${cmd}" >/dev/null 2>&1; then
    return 0
  fi

  if [[ -z "${SUDO}" ]]; then
    echo "${cmd} is required but not installed, and sudo is unavailable." >&2
    exit 1
  fi

  echo "Installing ${pkg}..."
  ${SUDO} apt-get update
  ${SUDO} DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkg}"
}

# kubectl в стандартных репозиториях Ubuntu нет: apt-get install kubectl упал бы с невнятным
# «Unable to locate package», поэтому просим поставить его руками.
if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required but not installed." >&2
  echo "Install it with 'snap install kubectl --classic' or follow https://kubernetes.io/docs/tasks/tools/#kubectl" >&2
  exit 1
fi

ensure_command docker docker.io
ensure_command python3 python3
ensure_command openssl openssl

# С ClusterIP снаружи ничего не слушает — правило открывало бы порт впустую (см. «Access» в README).
if [[ "${FRONTEND_SERVICE_TYPE}" != "ClusterIP" ]] && command -v ufw >/dev/null 2>&1; then
  echo "Allowing inbound TCP/9443 via ufw..."
  ${SUDO} ufw allow 9443/tcp
fi

if [[ "${SKIP_CLUSTER_CHECK:-false}" != "true" ]]; then
  current_context="$(kubectl config current-context 2>/dev/null || true)"
  contexts="$(kubectl config get-contexts -o name 2>/dev/null || true)"
  context_count="$(printf "%s" "${contexts}" | sed '/^$/d' | wc -l | tr -d ' ')"

  if [[ -z "${current_context}" ]] && [[ "${context_count}" == "0" ]] && [[ -f /etc/rancher/k3s/k3s.yaml ]]; then
    export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
    current_context="$(kubectl config current-context 2>/dev/null || true)"
    contexts="$(kubectl config get-contexts -o name 2>/dev/null || true)"
    context_count="$(printf "%s" "${contexts}" | sed '/^$/d' | wc -l | tr -d ' ')"
    if [[ -n "${current_context}" ]]; then
      echo "No current context configured; using k3s context '${current_context}' from /etc/rancher/k3s/k3s.yaml." >&2
    fi
  fi

  if [[ -z "${current_context}" ]] && [[ "${context_count}" == "1" ]]; then
    selected_context="$(printf "%s" "${contexts}" | head -n 1)"
    if [[ -n "${KUBECONFIG:-}" ]] && [[ "${KUBECONFIG}" == "/etc/rancher/k3s/k3s.yaml" ]]; then
      echo "No current context configured; using k3s context '${selected_context}' from /etc/rancher/k3s/k3s.yaml." >&2
    else
      echo "No current context configured; using the only available context '${selected_context}'." >&2
    fi
    kubectl config use-context "${selected_context}" >/dev/null
    current_context="${selected_context}"
  fi

  if [[ -z "${current_context}" ]] && command -v kind >/dev/null 2>&1; then
    kind_cluster="$(kind get clusters 2>/dev/null | head -n 1 || true)"
    if [[ -n "${kind_cluster}" ]]; then
      selected_context="kind-${kind_cluster}"
      echo "No current context configured; selecting kind context '${selected_context}'." >&2
      kubectl config use-context "${selected_context}" >/dev/null
      current_context="${selected_context}"
    fi
  fi

  if [[ -z "${current_context}" ]] && command -v minikube >/dev/null 2>&1; then
    if minikube status >/dev/null 2>&1; then
      selected_context="minikube"
      echo "No current context configured; selecting minikube context '${selected_context}'." >&2
      kubectl config use-context "${selected_context}" >/dev/null
      current_context="${selected_context}"
    fi
  fi

  if [[ -z "${current_context}" ]]; then
    echo "Unable to reach the Kubernetes cluster (no current context configured)." >&2
    if [[ -n "${contexts:-}" ]]; then
      context_count="$(printf "%s" "${contexts}" | sed '/^$/d' | wc -l | tr -d ' ')"
      if [[ "${context_count}" -gt 1 ]]; then
        echo "Available contexts:" >&2
        printf "%s\n" "${contexts}" >&2
      fi
    fi
    echo "Configure kubectl (e.g., 'kubectl config use-context <name>' or start your cluster) or set SKIP_CLUSTER_CHECK=true to skip." >&2
    exit 1
  fi

  if ! kubectl cluster-info --request-timeout=5s >/dev/null 2>&1; then
    echo "Unable to reach the Kubernetes cluster for context '${current_context}'." >&2
    echo "Configure kubectl (e.g., 'kubectl config use-context <name>' or start your cluster) or set SKIP_CLUSTER_CHECK=true to skip." >&2
    exit 1
  fi
fi

echo "Building backend image ${BACKEND_IMAGE}..."
docker build -f "${APP_ROOT}/backend/Dockerfile" -t "${BACKEND_IMAGE}" "${APP_ROOT}"

echo "Building frontend image ${FRONTEND_IMAGE}..."
docker build -f "${APP_ROOT}/frontend/Dockerfile" \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  -t "${FRONTEND_IMAGE}" "${APP_ROOT}"

# Идентификатор собранного образа уезжает в аннотацию пода: тег остаётся прежним, и без этого
# повторная установка не перезапустила бы поды на новом образе. Присваивание отдельной строкой —
# иначе `set -e` не заметил бы падения docker inspect.
BACKEND_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${BACKEND_IMAGE}")"
FRONTEND_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "${FRONTEND_IMAGE}")"
export BACKEND_IMAGE_ID FRONTEND_IMAGE_ID

if [[ -n "${IMAGE_REGISTRY}" ]]; then
  echo "Pushing images to ${IMAGE_REGISTRY}..."
  docker push "${BACKEND_IMAGE}"
  docker push "${FRONTEND_IMAGE}"
else
  current_context="$(kubectl config current-context 2>/dev/null || true)"
  if [[ "${current_context}" == kind* ]] && command -v kind >/dev/null 2>&1; then
    echo "Loading images into kind cluster ${current_context}..."
    kind load docker-image "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}"
  elif command -v minikube >/dev/null 2>&1 && minikube status >/dev/null 2>&1; then
    echo "Loading images into minikube..."
    minikube image load "${BACKEND_IMAGE}"
    minikube image load "${FRONTEND_IMAGE}"
  else
    echo "Skipping image load: using local images if supported by the cluster." >&2
  fi
fi

read_secret_key() {
  local secret="$1"
  local key="$2"
  kubectl get secret "${secret}" -n "${NAMESPACE}" -o jsonpath="{.data.${key}}" 2>/dev/null \
    | base64 -d 2>/dev/null || true
}

# Пароль БД не хранится в репозитории. Переиспользуем уже развёрнутый в кластере, иначе генерируем:
# у тома PostgreSQL пароль фиксируется при первичной инициализации, и разойтись они не должны.
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD="$(read_secret_key book-read-db POSTGRES_PASSWORD)"
fi
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_PASSWORD is not set - generating a new one..."
  POSTGRES_PASSWORD="$(openssl rand -base64 24)"
fi
export POSTGRES_PASSWORD

# Секрет подписи JWT не хранится в репозитории. Переиспользуем уже развёрнутый в кластере,
# иначе генерируем новый: смена секрета разлогинивает всех пользователей.
if [[ -z "${SECURITY_JWT_SECRET:-}" ]]; then
  SECURITY_JWT_SECRET="$(read_secret_key book-read-backend SECURITY_JWT_SECRET)"
fi
if [[ -z "${SECURITY_JWT_SECRET:-}" ]]; then
  echo "SECURITY_JWT_SECRET is not set — generating a new one..."
  SECURITY_JWT_SECRET="$(openssl rand -base64 48)"
fi
export SECURITY_JWT_SECRET

echo "Deploying to Kubernetes namespace ${NAMESPACE}..."

template="${SCRIPT_DIR}/k8s/manifest.yaml"
rendered="$(mktemp)"

python3 - "${template}" > "${rendered}" <<'PY'
import os
import sys

template_path = sys.argv[1]
with open(template_path, "r", encoding="utf-8") as handle:
    data = handle.read()

sys.stdout.write(os.path.expandvars(data))
PY

kubectl apply --validate=false -f "${rendered}"

rm -f "${rendered}"

echo "Waiting for deployments to be ready..."
rollout_status() {
  local name="$1"
  if ! kubectl rollout status "deployment/${name}" -n "${NAMESPACE}" --timeout="${ROLLOUT_TIMEOUT}"; then
    echo "Deployment '${name}' did not become ready within ${ROLLOUT_TIMEOUT}." >&2
    kubectl get pods -n "${NAMESPACE}" -o wide >&2 || true
    kubectl describe "deployment/${name}" -n "${NAMESPACE}" >&2 || true
    kubectl logs -n "${NAMESPACE}" -l "app=${name}" --all-containers=true --tail=200 >&2 || true
    return 1
  fi
}

rollout_status db
rollout_status backend
rollout_status frontend

echo "Deployment complete."
