import React from 'react';

const VerticalList = ({ verticals, selectedKey, onSelect }) => (
  <aside style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="vertical-list">
    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 8 }}>
      VERTICALES
    </div>
    {verticals.map((vertical) => {
      const selected = selectedKey === vertical.key;
      return (
        <button
          key={vertical.key}
          type="button"
          onClick={() => onSelect(vertical.key)}
          data-testid={`vertical-${vertical.key}`}
          style={{
            alignItems: 'center',
            background: selected ? 'rgba(0,200,150,0.13)' : 'transparent',
            border: selected ? '1px solid rgba(0,200,150,0.45)' : '1px solid transparent',
            borderRadius: 10,
            color: selected ? '#00C896' : 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            display: 'flex',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: selected ? 700 : 500,
            justifyContent: 'space-between',
            padding: '0.7rem 0.8rem',
            textAlign: 'left',
          }}
        >
          <span>{vertical.name}</span>
          <span style={{ color: selected ? '#00C896' : 'rgba(255,255,255,0.35)', fontSize: 11 }}>{vertical.key}</span>
        </button>
      );
    })}
  </aside>
);

export default VerticalList;
