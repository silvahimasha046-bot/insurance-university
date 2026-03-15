package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.SessionLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionLogRepository extends JpaRepository<SessionLogEntity, Long> {

    @Query("SELECT s FROM SessionLogEntity s WHERE " +
           "(:from IS NULL OR s.timestamp >= :from) AND " +
           "(:to IS NULL OR s.timestamp <= :to) AND " +
           "(:eventType IS NULL OR s.eventType = :eventType) AND " +
           "(:sessionHash IS NULL OR s.sessionHash = :sessionHash) AND " +
           "(:userSegment IS NULL OR s.userSegment = :userSegment)")
    Page<SessionLogEntity> search(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("eventType") String eventType,
            @Param("sessionHash") String sessionHash,
            @Param("userSegment") String userSegment,
            Pageable pageable);

    @Query("SELECT s FROM SessionLogEntity s WHERE " +
           "(:from IS NULL OR s.timestamp >= :from) AND " +
           "(:to IS NULL OR s.timestamp <= :to) AND " +
           "(:eventType IS NULL OR s.eventType = :eventType) AND " +
           "(:sessionHash IS NULL OR s.sessionHash = :sessionHash) AND " +
           "(:userSegment IS NULL OR s.userSegment = :userSegment)")
    List<SessionLogEntity> searchAll(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("eventType") String eventType,
            @Param("sessionHash") String sessionHash,
            @Param("userSegment") String userSegment);
}
