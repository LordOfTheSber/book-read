package com.library.tracker.service.social;

import com.library.tracker.domain.LibraryItem;
import com.library.tracker.domain.Loan;
import com.library.tracker.domain.Role;
import com.library.tracker.domain.User;
import com.library.tracker.repository.LoanRepository;
import com.library.tracker.service.LibraryItemAccess;
import com.library.tracker.service.UserService;
import com.library.tracker.web.dto.LoanRequest;
import com.library.tracker.web.dto.LoanResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith( MockitoExtension.class )
class LoanServiceTest {

    private static final LocalDate TODAY = LocalDate.of( 2026, 8, 7 );

    private static final Clock FIXED_CLOCK = Clock.fixed( Instant.parse( "2026-08-07T10:00:00Z" ), ZoneOffset.UTC );

    @Mock
    private LoanRepository loanRepository;

    @Mock
    private LibraryItemAccess itemAccess;

    @Mock
    private UserService userService;

    private LoanService service;

    private User owner;

    @BeforeEach
    void setUp() {
        service = new LoanService( loanRepository, itemAccess, userService, FIXED_CLOCK );
        owner = user();
        lenient().when( userService.getCurrentUser() ).thenReturn( owner );
        lenient().when( loanRepository.save( any( Loan.class ) ) ).thenAnswer( call -> call.getArgument( 0 ) );
    }

    /** Пустая дата выдачи — сегодня: запись почти всегда заводят в момент, когда книгу отдают. */
    @Test
    void missingLentDateDefaultsToToday() {
        LibraryItem item = item( owner );
        when( itemAccess.requireWritable( eq( item.getId() ), any() ) ).thenReturn( item );

        LoanResponse response = service.create( item.getId(), request( "Аня", null, null ) );

        assertThat( response.getLentOn() ).isEqualTo( TODAY );
        assertThat( response.isOverdue() ).isFalse();
    }

    /** Две открытые выдачи на одну запись означают, что первую забыли закрыть. */
    @Test
    void secondOpenLoanIsRejected() {
        LibraryItem item = item( owner );
        when( itemAccess.requireWritable( eq( item.getId() ), any() ) ).thenReturn( item );
        when( loanRepository.existsOpenForItem( item.getId() ) ).thenReturn( true );

        assertThatThrownBy( () -> service.create( item.getId(), request( "Аня", null, null ) ) )
                .isInstanceOf( IllegalArgumentException.class );
        verify( loanRepository, never() ).save( any( Loan.class ) );
    }

    @Test
    void dueDateBeforeLentDateIsRejected() {
        LibraryItem item = item( owner );
        when( itemAccess.requireWritable( eq( item.getId() ), any() ) ).thenReturn( item );

        LoanRequest request = request( "Аня", TODAY, TODAY.minusDays( 3 ) );

        assertThatThrownBy( () -> service.create( item.getId(), request ) )
                .isInstanceOf( IllegalArgumentException.class );
    }

    /** Просроченность считается на чтении: колонка требовала бы пересчёта каждую полночь. */
    @Test
    void overdueIsDerivedFromDueDate() {
        Loan loan = loan( owner, TODAY.minusDays( 30 ), TODAY.minusDays( 2 ) );
        when( loanRepository.findOpen( eq( owner.getId() ) ) ).thenReturn( List.of( loan ) );

        LoanResponse response = service.findOpen().get( 0 );

        assertThat( response.isOverdue() ).isTrue();
        assertThat( response.getDaysOut() ).isEqualTo( 30 );
    }

    @Test
    void returnWithoutDateClosesLoanToday() {
        Loan loan = loan( owner, TODAY.minusDays( 5 ), null );
        when( loanRepository.findById( loan.getId() ) ).thenReturn( Optional.of( loan ) );
        when( itemAccess.isOwnedBy( loan.getItem(), owner ) ).thenReturn( true );

        LoanResponse response = service.markReturned( loan.getId(), null ).orElseThrow();

        assertThat( response.getReturnedOn() ).isEqualTo( TODAY );
        assertThat( response.isOverdue() ).isFalse();
    }

    @Test
    void loanOfForeignItemCannotBeClosed() {
        Loan loan = loan( user(), TODAY.minusDays( 5 ), null );
        when( loanRepository.findById( loan.getId() ) ).thenReturn( Optional.of( loan ) );
        when( itemAccess.isOwnedBy( loan.getItem(), owner ) ).thenReturn( false );
        when( userService.isAdmin( owner ) ).thenReturn( false );

        assertThatThrownBy( () -> service.markReturned( loan.getId(), null ) )
                .isInstanceOf( AccessDeniedException.class );
    }

    private LoanRequest request( String borrower, LocalDate lentOn, LocalDate dueOn ) {
        LoanRequest request = new LoanRequest();
        request.setBorrowerName( borrower );
        request.setLentOn( lentOn );
        request.setDueOn( dueOn );
        return request;
    }

    private Loan loan( User itemOwner, LocalDate lentOn, LocalDate dueOn ) {
        Loan loan = new Loan();
        loan.setId( UUID.randomUUID() );
        loan.setItem( item( itemOwner ) );
        loan.setBorrowerName( "Аня" );
        loan.setLentOn( lentOn );
        loan.setDueOn( dueOn );
        return loan;
    }

    private LibraryItem item( User itemOwner ) {
        LibraryItem item = new LibraryItem();
        item.setId( UUID.randomUUID() );
        item.setTitle( "Задача трёх тел" );
        item.setCreatedBy( itemOwner );
        return item;
    }

    private User user() {
        User user = new User();
        user.setId( UUID.randomUUID() );
        user.setUsername( "reader-" + UUID.randomUUID() );
        user.setRole( Role.USER );
        return user;
    }
}
