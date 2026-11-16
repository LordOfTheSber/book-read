package com.library.tracker.web;

import com.library.tracker.service.engagement.AchievementService;
import com.library.tracker.service.engagement.ReadingGoalService;
import com.library.tracker.service.engagement.StreakService;
import com.library.tracker.service.engagement.YearInReviewService;
import com.library.tracker.web.dto.AchievementResponse;
import com.library.tracker.web.dto.ReadingGoalRequest;
import com.library.tracker.web.dto.ReadingGoalResponse;
import com.library.tracker.web.dto.StreakResponse;
import com.library.tracker.web.dto.YearInReviewResponse;
import jakarta.validation.Valid;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Цели и вовлечение: челлендж года, стрик, достижения и «Год в обзоре». Всё это про самого
 * спрашивающего, поэтому идентификатор пользователя нигде не принимается — только текущий.
 */
@RestController
@RequestMapping( "/api/v1/engagement" )
@RequiredArgsConstructor
public class EngagementController {

    private final ReadingGoalService readingGoalService;
    private final StreakService streakService;
    private final AchievementService achievementService;
    private final YearInReviewService yearInReviewService;

    @GetMapping( "/goals" )
    public List<ReadingGoalResponse> goals() {
        return readingGoalService.findAll();
    }

    /** Без года — текущий: цель почти всегда смотрят на этот год. */
    @GetMapping( "/goals/current" )
    public ReadingGoalResponse currentGoal( @RequestParam( required = false ) Integer year ) {
        return readingGoalService.find( year );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @PutMapping( "/goals/{year}" )
    public ReadingGoalResponse saveGoal( @PathVariable int year, @Valid @RequestBody ReadingGoalRequest request ) {
        return readingGoalService.save( year, request );
    }

    @PreAuthorize( "hasAnyRole('SUPER_ADMIN','ADMIN','EDITOR','USER')" )
    @DeleteMapping( "/goals/{year}" )
    public ResponseEntity<Void> deleteGoal( @PathVariable int year ) {
        readingGoalService.delete( year );
        return ResponseEntity.noContent().build();
    }

    @GetMapping( "/streak" )
    public StreakResponse streak() {
        return streakService.forCurrentUser();
    }

    /** Заодно выдаёт заслуженное: проверка по требованию дешевле ночного обхода всех пользователей. */
    @GetMapping( "/achievements" )
    public List<AchievementResponse> achievements() {
        return achievementService.listForCurrentUser();
    }

    @GetMapping( "/year-in-review" )
    public YearInReviewResponse yearInReview( @RequestParam( required = false ) Integer year ) {
        return yearInReviewService.forYear( year );
    }
}
