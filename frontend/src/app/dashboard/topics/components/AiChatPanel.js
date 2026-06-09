'use client';

import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { Cpu, X, Sparkle, Star, Lightbulb } from '@phosphor-icons/react';
import css from '../page.module.css';

function getConfidenceClass(confidence) {
  if (confidence >= 75) return css.confidenceHigh;
  if (confidence >= 50) return css.confidenceMedium;
  return css.confidenceLow;
}

export default function AiChatPanel({
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  suggestLoading,
  chatEndRef,
  handleSuggestTopics,
  handleSendChat,
  handleSelectSuggestedTopic,
  onClose,
}) {
  return (
    <div className={css.s45} onClick={onClose}>
      <div className={css.s46} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css.s47}>
          <div className={css.s48}>
            <div className={css.s49}>
              <Cpu size={20} />
            </div>
            <div>
              <h3 className={css.s50}>Trợ lý Đề tài AI</h3>
              <span className={css.s51}>Tư vấn & điều chỉnh đề tài theo nguyện vọng của bạn</span>
            </div>
          </div>

          <div className={css.s52}>
            <Button
              variant="secondary"
              size="sm"
              loading={suggestLoading}
              onClick={() => handleSuggestTopics(true)}
              className={css.s73}
            >
              <Sparkle size={13} /> Gợi ý lại
            </Button>
            <button onClick={onClose} className={css.s74}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className={css.s53}>
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={[
                css.messageWrap,
                msg.role === 'user' ? css.messageWrapUser : css.messageWrapAssistant,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {msg.type === 'suggestions' ? (
                <div className={css.s54}>
                  <div className={css.s55}>
                    <Cpu size={14} className={css.s56} />
                    Phân tích hồ sơ hoàn tất &bull; {msg.suggestions.length} gợi ý phù hợp &bull;
                    <span className={css.s57}> Bấm vào đề tài để chỉnh sửa</span>
                  </div>

                  {msg.suggestions.length === 0 ? (
                    <div className={css.s58}>
                      Chưa tìm thấy đề tài phù hợp với hồ sơ hiện tại. Bạn có thể chat để mô tả định hướng của
                      mình.
                    </div>
                  ) : (
                    msg.suggestions.map((s, si) => (
                      <div
                        key={s.topicId || si}
                        onClick={() => {
                          setChatInput(`Tôi muốn điều chỉnh đề tài "${s.title}" theo hướng: `);
                        }}
                        className={css.s75}
                      >
                        <div className={css.s59}>
                          <span className={css.s60}>{s.title}</span>
                          <span className={[css.confidenceBadge, getConfidenceClass(s.confidence)].filter(Boolean).join(' ')}>
                            <Star size={10} weight="fill" /> {s.confidence}%
                          </span>
                        </div>

                        <p className={css.s61}>{s.reason}</p>

                        <div className={css.s62}>
                          <div className={css.s63}>
                            <Lightbulb size={12} /> Bấm để đề xuất chỉnh sửa
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            className={css.s64}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestedTopic(s);
                            }}
                          >
                            Chọn đề tài này
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : msg.role === 'user' ? (
                <div className={css.s65}>{msg.content}</div>
              ) : (
                <div className={css.s66}>{msg.content}</div>
              )}
            </div>
          ))}

          {chatLoading && (
            <div className={css.s67}>
              <Spinner size="sm" />
              <span>AI đang soạn câu trả lời...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className={css.s68}>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendChat();
              }
            }}
            placeholder="Trao đổi với AI về đề tài của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
            rows={2}
            disabled={chatLoading}
            className={css.s76}
          />
          <Button
            variant="primary"
            size="sm"
            loading={chatLoading}
            disabled={!chatInput.trim()}
            onClick={handleSendChat}
            className={css.s69}
          >
            Gửi
          </Button>
        </div>
      </div>
    </div>
  );
}
