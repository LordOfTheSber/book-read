package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Loan;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.service.LibraryItemAccess;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.LoanRequest;
import com.library.tracker.web.dto.LoanResponse;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Учёт выданных экземпляров: кому отдана книга и когда её ждать обратно. Заёмщик — просто имя,
 * а не пользователь сервиса: книги чаще отдают тем, кого здесь нет, и требовать регистрации ради
 * записи «у Ани с марта» незачем.
 * <p>
 * Просроченность считается на чтении, а не хранится колонкой: иначе её пришлось бы пересчитывать
 * по всей таблице каждую полночь, и любой сбой этого пересчёта врал бы молча.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LoanService {

    private final LoanRepository loanRepository;
    private final LibraryItemAccess itemAccess;
    private final UserService userService;
    private final Clock clock;

    @Transactional( readOnly = true )
    public List<LoanResponse> findByItem( UUID itemId ) {
        LibraryItem item = itemAccess.requireReadable( itemId );
        return loanRepository.findByItemIdOrderByLentOnDesc( item.getId() ).stream()
                             .map( this::toResponse )
                             .toList();
    }

    /** Что сейчас на руках по всей библиотеке — с просроченными в начале списка. */
    @Transactional( readOnly = true )
    public List<LoanResponse> findOpen() {
        User currentUser = userService.getCurrentUser();
        UUID scope = userService.isAdmin( currentUser ) ? null : currentUser.getId();
        return loanRepository.findOpen( scope ).stream().map( this::toResponse ).toList();
    }

    public LoanResponse create( UUID itemId, LoanRequest request ) {
        LibraryItem item = itemAccess.requireWritable( itemId, "Вы можете выдавать только свои книги" );
        // Одновременно на руках экземпляр один: второй экземпляр — это вторая запись в библиотеке,
        // а две открытые выдачи на одну запись означают, что одну из них забыли закрыть.
        if ( loanRepository.existsOpenForItem( itemId ) ) {
            throw new IllegalArgumentException( "Книга уже выдана и пока не возвращена" );
        }

        Loan loan = new Loan();
        loan.setItem( item );
        applyRequest( loan, request );
        return toResponse( loanRepository.save( loan ) );
    }

    public Optional<LoanResponse> update( UUID loanId, LoanRequest request ) {
        return findWritable( loanId ).map( loan -> {
            applyRequest( loan, request );
            return toResponse( loanRepository.save( loan ) );
        } );
    }

    /** Возврат отдельным действием: это одно нажатие, а не правка формы из пяти полей. */
    public Optional<LoanResponse> markReturned( UUID loanId, LocalDate returnedOn ) {
        return findWritable( loanId ).map( loan -> {
            LocalDate date = returnedOn != null ? returnedOn : LocalDate.now( clock );
            if ( date.isBefore( loan.getLentOn() ) ) {
                throw new IllegalArgumentException( "Дата возврата раньше даты выдачи" );
            }
            loan.setReturnedOn( date );
            return toResponse( loanRepository.save( loan ) );
        } );
    }

    public void delete( UUID loanId ) {
        findWritable( loanId ).ifPresent( loanRepository::delete );
    }

    private Optional<Loan> findWritable( UUID loanId ) {
        User currentUser = userService.getCurrentUser();
        return loanRepository.findById( loanId ).map( loan -> {
            LibraryItem item = loan.getItem();
            if ( !userService.isAdmin( currentUser ) && !itemAccess.isOwnedBy( item, currentUser ) ) {
                throw new AccessDeniedException( "Вы можете вести выдачи только своих книг" );
            }
            return loan;
        } );
    }

    private void applyRequest( Loan loan, LoanRequest request ) {
        loan.setBorrowerName( request.getBorrowerName().trim() );
        loan.setBorrowerContact( trimToNull( request.getBorrowerContact() ) );
        // Пустая дата выдачи — сегодня: запись почти всегда заводят в момент, когда книгу отдают.
        loan.setLentOn( request.getLentOn() != null ? request.getLentOn() : LocalDate.now( clock ) );
        loan.setDueOn( request.getDueOn() );
        loan.setNote( trimToNull( request.getNote() ) );
        if ( loan.getDueOn() != null && loan.getDueOn().isBefore( loan.getLentOn() ) ) {
            throw new IllegalArgumentException( "Дата возврата раньше даты выдачи" );
        }
    }

    private LoanResponse toResponse( Loan loan ) {
        LocalDate today = LocalDate.now( clock );
        LocalDate until = loan.getReturnedOn() != null ? loan.getReturnedOn() : today;
        boolean overdue = loan.getReturnedOn() == null
                          && loan.getDueOn() != null
                          && loan.getDueOn().isBefore( today );

        return LoanResponse.builder()
                           .id( loan.getId() )
                           .itemId( loan.getItem().getId() )
                           .itemTitle( loan.getItem().getTitle() )
                           .borrowerName( loan.getBorrowerName() )
                           .borrowerContact( loan.getBorrowerContact() )
                           .lentOn( loan.getLentOn() )
                           .dueOn( loan.getDueOn() )
                           .returnedOn( loan.getReturnedOn() )
                           .note( loan.getNote() )
                           .overdue( overdue )
                           .daysOut( ChronoUnit.DAYS.between( loan.getLentOn(), until ) )
                           .build();
    }

    private String trimToNull( String value ) {
        return StringUtils.hasText( value ) ? value.trim() : null;
    }
}
