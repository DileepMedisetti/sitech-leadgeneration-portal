import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, X, Check, Globe } from 'lucide-react';
import { COUNTRIES } from '../../data/countries';

export default function CountrySelect({
  value,
  onChange,
  required = false,
  disabled = false,
  id,
}) {
  const generatedId = useId();
  const inputId = id || `country-select-${generatedId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Selected country object
  const selectedCountry = COUNTRIES.find(
    (c) => c.name.toLowerCase() === (value || '').toLowerCase() || c.code === value
  );

  // Filter countries
  const filteredCountries = COUNTRIES.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  // Keep highlighted index in view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeElement = listRef.current.children[highlightedIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (country) => {
    onChange(country.name);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCountries.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCountries.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCountries[highlightedIndex]) {
          handleSelect(filteredCountries[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={handleKeyDown}
    >
      {/* Combobox Trigger / Search Input */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            if (!isOpen) {
              setSearchQuery('');
              setHighlightedIndex(0);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }
        }}
        className="form-control"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '8px 12px',
          borderColor: isOpen ? 'var(--primary)' : 'var(--border-color)',
          boxShadow: isOpen ? '0 0 0 3px rgba(13, 148, 136, 0.15)' : 'none',
          backgroundColor: disabled ? 'var(--surface-active)' : '#ffffff',
          minHeight: '40px',
        }}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${inputId}-listbox`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <Globe size={15} color="var(--primary)" style={{ flexShrink: 0 }} />

          {isOpen ? (
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Type to search country..."
              onClick={(e) => e.stopPropagation()}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                color: 'var(--text-primary)',
                backgroundColor: 'transparent',
                padding: 0,
              }}
              autoFocus
            />
          ) : (
            <span
              style={{
                fontSize: '13px',
                color: selectedCountry ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: selectedCountry ? 500 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedCountry ? `${selectedCountry.name} (${selectedCountry.code})` : 'Select target institution country...'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selectedCountry && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                borderRadius: '50%',
              }}
              title="Clear country selection"
              aria-label="Clear country selection"
            >
              <X size={14} />
            </button>
          )}

          <ChevronDown
            size={15}
            color="var(--text-muted)"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </div>

      {/* Dropdown Options List */}
      {isOpen && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '260px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            padding: '4px 0',
          }}
        >
          {filteredCountries.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              No countries found matching "{searchQuery}".
            </div>
          ) : (
            filteredCountries.map((c, index) => {
              const isSelected = selectedCountry?.code === c.code;
              const isHighlighted = highlightedIndex === index;

              return (
                <div
                  key={c.code}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(c)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isHighlighted
                      ? 'var(--surface-hover)'
                      : isSelected
                      ? 'var(--primary-light)'
                      : 'transparent',
                    color: isSelected ? 'var(--primary-text)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{c.name}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-app)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      {c.code}
                    </span>
                  </div>

                  {isSelected && <Check size={14} color="var(--primary)" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
