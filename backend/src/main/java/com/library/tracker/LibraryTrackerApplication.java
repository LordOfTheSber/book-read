package com.library.tracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LibraryTrackerApplication {
    public static void main(String[] args) {
        SpringApplication.run(LibraryTrackerApplication.class, args);
    }
}
