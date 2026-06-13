import React from 'react';

/**
 * FormCard — A reusable styling container (Card) for config forms,
 * matching the Cyberpunk Terminal aesthetics.
 * 
 * @param {object} props
 * @param {string} [props.title] - Optional title of the card, displays as "// TITLE"
 * @param {React.ReactNode} [props.headerActions] - Optional action buttons placed on the right side of the header
 * @param {'secondary' | 'tertiary'} [props.bg] - Background theme variant
 * @param {React.ReactNode} props.children - Contents of the card
 * @param {object} [props.style] - Override container style
 * @param {object} [props.bodyStyle] - Override body wrapper style
 */
export default function FormCard({
  title,
  headerActions,
  bg = 'tertiary',
  children,
  style = {},
  bodyStyle = {}
}) {
  const background = bg === 'secondary' ? 'var(--bg-secondary)' : 'var(--bg-tertiary)';

  return (
    <div
      style={{
        background,
        border: '1px solid var(--border-color)',
        padding: '16px',
        borderRadius: '2px',
        ...style
      }}
    >
      {(title || headerActions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px'
          }}
        >
          {title && (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: 'var(--accent-primary)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {title}
            </div>
          )}
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      <div style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
