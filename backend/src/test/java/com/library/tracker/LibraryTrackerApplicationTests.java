package com.library.tracker;

import com.library.tracker.integration.PostgresContainerTest;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class LibraryTrackerApplicationTests extends PostgresContainerTest {

    @Test
    void contextLoads() {
    }
}
