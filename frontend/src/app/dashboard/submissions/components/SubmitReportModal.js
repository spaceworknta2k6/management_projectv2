'use client';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Check, Upload } from '@phosphor-icons/react';
import css from '../page.module.css';

export default function SubmitReportModal({
  onClose,
  handleSubmissionSubmit,
  handleFileUpload,
  uploadingFile,
  uploadedFileId,
  fileName,
  submissionNote,
  setSubmissionNote,
  submittingWork,
}) {
  return (
    <div className={css.s27}>
      <div className={css.s28}>
        <div className={css.s29}>
          <h3 className={css.s30}>Nop tai lieu bao cao do an</h3>
          <button onClick={onClose} className={css.s66}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmissionSubmit} className={css.s31}>
          <div className={css.s32}>
            <label className={css.s33}>
              Chon bao cao (PDF, ZIP, DOCX, gioi han 10MB) <span className={css.s34}>*</span>
            </label>
            <div className={css.s35}>
              <input type="file" onChange={handleFileUpload} className={css.s36} />
              {uploadingFile ? (
                <div className={css.s37}>
                  <Spinner />
                  <span>Dang tai tep tin va quet virus an toan...</span>
                </div>
              ) : fileName ? (
                <div className={css.s38}>
                  <Check size={28} className={css.s39} />
                  <span className={css.s40}>{fileName}</span>
                  <span className={css.s41}>Nhap de chon tep tin khac</span>
                </div>
              ) : (
                <div className={css.s42}>
                  <Upload size={28} className={css.s43} />
                  <span className={css.s44}>Keo tha hoac nhap de chon tep tin tai len</span>
                </div>
              )}
            </div>
          </div>

          <Input
            label="Ghi chu dinh kem"
            value={submissionNote}
            onChange={(e) => setSubmissionNote(e.target.value)}
            placeholder="Nhap loi nhan gui giang vien huong dan..."
          />

          <div className={css.s45}>
            <Button variant="secondary" onClick={onClose}>
              Huy
            </Button>
            <Button variant="primary" type="submit" loading={submittingWork} disabled={!uploadedFileId}>
              Nop bai ngay
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
