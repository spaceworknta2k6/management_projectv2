'use client';

import Card from '@/components/ui/Card';
import { Gavel, Gear } from '@phosphor-icons/react';

export default function CommitteesPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gavel size={28} style={{ color: 'var(--accent)' }} />
          Hội đồng Đánh giá
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Thành lập hội đồng bảo vệ đồ án tốt nghiệp và phân công thành viên phản biện
        </p>
      </div>

      <Card>
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            display: 'inline-block',
            animation: 'spin 8s linear infinite'
          }}>
            <Gear size={48} weight="duotone" style={{ color: 'var(--accent)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Phân hệ Hội đồng bảo vệ đang được phát triển
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
            Phân hệ này hiện đang được hoàn thiện và tích hợp vào hệ thống Episteme. Vui lòng quay lại sau hoặc liên hệ với ban quản trị để biết thêm chi tiết.
          </p>
        </div>
      </Card>
    </div>
  );
}
