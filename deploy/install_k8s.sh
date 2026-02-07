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
export DOMAIN="${DOMAIN:-localhost}"
export VITE_API_URL="${VITE_API_URL:-/api/v1}"
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-prod}"
export POSTGRES_DB="${POSTGRES_DB:-library}"
export POSTGRES_USER="${POSTGRES_USER:-library}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-library}"
export DB_STORAGE_SIZE="${DB_STORAGE_SIZE:-1Gi}"
export BACKEND_REPLICAS="${BACKEND_REPLICAS:-2}"
export FRONTEND_REPLICAS="${FRONTEND_REPLICAS:-1}"
export FRONTEND_SERVICE_TYPE="${FRONTEND_SERVICE_TYPE:-LoadBalancer}"
export IMAGE_TAG="${IMAGE_TAG:-local}"
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"

export BACKEND_IMAGE="${IMAGE_REGISTRY:+${IMAGE_REGISTRY}/}book-read-backend:${IMAGE_TAG}"
export FRONTEND_IMAGE="${IMAGE_REGISTRY:+${IMAGE_REGISTRY}/}book-read-frontend:${IMAGE_TAG}"

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

ensure_command kubectl kubectl
ensure_command docker docker.io
ensure_command python3 python3

if command -v ufw >/dev/null 2>&1; then
  echo "Allowing inbound TCP/9443 via ufw..."
  ${SUDO} ufw allow 9443/tcp
fi

if [[ "${SKIP_CLUSTER_CHECK:-false}" != "true" ]]; then
  if ! kubectl cluster-info --request-timeout=5s >/dev/null 2>&1; then
    echo "Unable to reach the Kubernetes cluster. Ensure kubectl context is configured or set SKIP_CLUSTER_CHECK=true to skip." >&2
    exit 1
  fi
fi

echo "Building backend image ${BACKEND_IMAGE}..."
docker build -f "${APP_ROOT}/backend/Dockerfile" -t "${BACKEND_IMAGE}" "${APP_ROOT}"

echo "Building frontend image ${FRONTEND_IMAGE}..."
docker build -f "${APP_ROOT}/frontend/Dockerfile" \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  -t "${FRONTEND_IMAGE}" "${APP_ROOT}"

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
kubectl rollout status deployment/db -n "${NAMESPACE}"
kubectl rollout status deployment/backend -n "${NAMESPACE}"
kubectl rollout status deployment/frontend -n "${NAMESPACE}"

echo "Deployment complete."
