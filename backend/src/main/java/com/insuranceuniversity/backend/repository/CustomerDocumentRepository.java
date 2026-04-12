package com.insuranceuniversity.backend.repository;

import com.insuranceuniversity.backend.entity.CustomerDocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerDocumentRepository extends JpaRepository<CustomerDocumentEntity, Long> {

    List<CustomerDocumentEntity> findBySessionIdAndLatestForSessionTrueOrderByUploadedAtDesc(String sessionId);

    List<CustomerDocumentEntity> findByUserEmailAndLatestForUserTrueOrderByUploadedAtDesc(String userEmail);

    Optional<CustomerDocumentEntity> findFirstBySessionIdAndDocTypeAndDocSideAndLatestForSessionTrueOrderByUploadedAtDesc(
            String sessionId,
            String docType,
            String docSide
    );

    Optional<CustomerDocumentEntity> findFirstByUserEmailAndDocTypeAndDocSideAndLatestForUserTrueOrderByUploadedAtDesc(
            String userEmail,
            String docType,
            String docSide
    );

    List<CustomerDocumentEntity> findBySessionIdAndDocTypeAndDocSideOrderByVersionNoDesc(
            String sessionId,
            String docType,
            String docSide
    );
}
