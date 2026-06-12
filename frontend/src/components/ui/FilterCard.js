'use client';

import { useState } from 'react';
import { Funnel, MagnifyingGlass, X } from '@phosphor-icons/react';
import Card from './Card';
import Button from './Button';
import css from './FilterCard.module.css';

/**
 * FilterCard component is a collapsible search & advanced filters container.
 */
export default function FilterCard({
  searchInput,
  setSearchInput,
  onSearch,
  onReset,
  placeholder = 'Tìm kiếm...',
  hasFilters = false,
  children,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={css.filterCard}>
      <form onSubmit={onSearch}>
        <div className={css.headerRow}>
          <div className={css.searchWrapper}>
            <input
              type="text"
              placeholder={placeholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={css.searchInput}
            />
            <MagnifyingGlass size={18} className={css.searchIcon} />
          </div>
          <div className={css.actionButtons}>
            <Button type="submit" variant="primary" size="sm">
              Tìm kiếm
            </Button>
            {hasFilters && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={isExpanded ? css.activeFilterBtn : ''}
              >
                <Funnel size={16} />
                Bộ lọc nâng cao
              </Button>
            )}
            {(searchInput.trim() !== '' || isExpanded) && (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                <X size={16} />
                Xóa lọc
              </Button>
            )}
          </div>
        </div>

        {hasFilters && isExpanded && (
          <div className={css.expandedContent}>
            <div className={css.filterGrid}>{children}</div>
          </div>
        )}
      </form>
    </Card>
  );
}
