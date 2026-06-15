'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/services/api';
import Spinner from '@/components/ui/Spinner';
import Card from '@/components/ui/Card';
import { ShieldCheck, Warning, GraduationCap } from '@phosphor-icons/react';
import css from './page.module.css';

export default function PublicScoreVerificationPage() {
  const { id } = useParams();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    api.get(`/scores/score-sheets/${id}/public-verify`)
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError('Không tìm thấy dữ liệu phiếu điểm.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Lỗi kết nối máy chủ xác thực.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className={css.container}>
        <div className={css.loading}>
          <Spinner size="lg" />
          <p>Đang truy xuất thông tin chứng thực từ hệ thống...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.sheet) {
    return (
      <div className={css.container}>
        <div className={css.wrapper}>
          <Card className={css.errorCard}>
            <Warning size={48} color="var(--error)" />
            <h2 className={css.errorTitle}>Xác Thực Thất Bại</h2>
            <p className={css.errorText}>
              {error || 'Phiếu điểm này không tồn tại hoặc đã bị thu hồi khỏi hệ thống dữ liệu trực tuyến.'}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const { sheet, integrityHash, verificationSubject } = data;
  const student = verificationSubject?.primaryStudent || {};
  const grader = sheet.graderId?.userId || {};
  const project = sheet.projectId || {};
  const topic = project.topicId || {};
  const period = sheet.periodId || {};

  return (
    <div className={css.container}>
      <div className={css.wrapper}>
        <div className={css.badgeContainer}>
          <div className={css.badgeTitle}>
            <ShieldCheck size={28} weight="fill" />
            PHIẾU ĐIỂM HỢP LỆ
          </div>
          <div className={css.badgeSub}>
            Thông tin điểm số đã được xác thực bảo mật và đối chiếu khớp với cơ sở dữ liệu gốc của nhà trường.
          </div>
        </div>

        <Card className={css.card}>
          <div className={css.header}>
            <div className={css.university}>TRƯỜNG ĐẠI HỌC BÁCH KHOA HÀ NỘI</div>
            <h1 className={css.title}>Xác Thực Phiếu Điểm Đồ Án</h1>
          </div>

          <div className={css.infoGrid}>
            <div>
              <div className={css.infoLabel}>Sinh viên thực hiện</div>
              <div className={css.infoVal}>{student.fullName || verificationSubject?.displayName || 'N/A'}</div>
            </div>
            <div>
              <div className={css.infoLabel}>Mã số sinh viên</div>
              <div className={css.infoVal}>{student.studentCode || 'N/A'}</div>
            </div>
            <div>
              <div className={css.infoLabel}>Lớp sinh hoạt</div>
              <div className={css.infoVal}>{student.className || 'N/A'}</div>
            </div>
            {verificationSubject?.ownerType === 'group' && (
              <div>
                <div className={css.infoLabel}>Nhóm sinh viên</div>
                <div className={css.infoVal}>{verificationSubject.groupName || verificationSubject.displayName || 'N/A'}</div>
              </div>
            )}
            <div>
              <div className={css.infoLabel}>Đợt đồ án</div>
              <div className={css.infoVal}>{period.name || 'N/A'}</div>
            </div>
            <div className={css.spanFull}>
              <div className={css.infoLabel}>Đề tài đồ án tốt nghiệp</div>
              <div className={css.infoVal}>{topic.title || 'N/A'}</div>
            </div>
            <div>
              <div className={css.infoLabel}>Giảng viên chấm điểm</div>
              <div className={css.infoVal}>{grader.fullName || 'N/A'}</div>
            </div>
            <div>
              <div className={css.infoLabel}>Vai trò chấm điểm</div>
              <div className={css.infoVal}>
                {sheet.rubricRole === 'SUPERVISOR' && 'Giảng viên hướng dẫn'}
                {sheet.rubricRole === 'REVIEWER' && 'Giảng viên phản biện'}
                {sheet.rubricRole === 'COMMITTEE_MEMBER' && `Thành viên Hội đồng (${sheet.graderRole})`}
              </div>
            </div>
          </div>

          <table className={css.table}>
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Mã TC</th>
                <th>Tên tiêu chí chấm</th>
                <th style={{ width: '80px' }}>Trọng số</th>
                <th style={{ width: '80px' }}>Tối đa</th>
                <th style={{ width: '80px' }}>Điểm chấm</th>
              </tr>
            </thead>
            <tbody>
              {sheet.criteriaScores?.map((c, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'monospace' }}>{c.criteriaCode}</td>
                  <td>{c.criteriaName}</td>
                  <td>{c.weight}</td>
                  <td>{c.maxScore}</td>
                  <td style={{ fontWeight: 'bold' }}>{c.score}</td>
                </tr>
              ))}
              <tr className={css.totalRow}>
                <td colSpan="4" style={{ textAlign: 'right' }}>Điểm tổng kết (đã nhân trọng số):</td>
                <td className={css.totalVal}>{sheet.roundedTotal} / 10</td>
              </tr>
            </tbody>
          </table>

          {sheet.comment && (
            <div className={css.commentBox}>
              <div className={css.commentTitle}>Nhận xét từ Giảng viên</div>
              <div className={css.commentContent}>{sheet.comment}</div>
            </div>
          )}

          <div className={css.securitySection}>
            <div style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Mã băm toàn vẹn dữ liệu (Integrity Hash)</div>
            <div className={css.securityHash}>{integrityHash}</div>
            <div style={{ fontSize: '11px', lineHeight: '1.4', marginTop: '4px' }}>
              Mã băm được sinh bằng thuật toán mật mã SHA256 dựa trên dữ liệu phiếu điểm và mã khóa nội bộ của nhà trường. Bất kỳ sự chỉnh sửa cơ học nào về thông tin điểm số trên bản in giấy sẽ dẫn đến mã băm không trùng khớp khi quét mã QR này.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
