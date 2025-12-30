
import React from 'react';

export const ScoreGuide: React.FC = () => {
    const styles = {
        container: {
            background: '#fff',
            border: '2px solid #e59866',
            borderRadius: '8px',
            padding: '10px',
            maxWidth: '350px',
            margin: '10px auto',
            fontSize: '0.85rem',
            fontFamily: 'sans-serif',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        },
        title: {
            textAlign: 'center' as const,
            background: '#fdf2e9',
            margin: '-10px -10px 10px -10px',
            padding: '8px',
            borderBottom: '1px solid #e59866',
            fontWeight: 'bold',
            borderRadius: '6px 6px 0 0'
        },
        row: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px dashed #eee',
            paddingBottom: '4px'
        },
        iconBox: {
            width: '40px',
            height: '40px',
            background: '#d35400',
            color: 'white',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
            marginRight: '10px',
            fontSize: '1.2rem',
            fontWeight: 'bold'
        },
        desc: {
            lineHeight: '1.3'
        },
        point: {
            color: '#c0392b',
            fontWeight: 'bold',
            background: '#fadbd8',
            padding: '1px 4px',
            borderRadius: '4px',
            fontSize: '0.8rem'
        }
    };

    const rules = [
        { icon: '🏠', text: '보너스 아이템 선택 (3배 점수)', pt: '아이템 점수' },
        { icon: '🧶', text: '타워별 실타래 개수 1등/2등', pt: '9점 / 3점' },
        { icon: '🦋', text: '즉시 발자국 +1개', pt: '개당 3점' },
        { icon: '🥣', text: '인접한 서로 다른 아이템 종류당', pt: '2점' },
        { icon: '🛋️', text: '배치된 층수(1~6)가 그대로 점수', pt: '층수 점수' },
        { icon: '🐭', text: '연결된 쥐들의 무리 크기 제곱', pt: '1/4/9...점' },
    ];

    return (
        <div style={styles.container}>
            <div style={styles.title}>📜 아이템 기능 및 점수</div>
            {rules.map((r, idx) => (
                <div key={idx} style={styles.row}>
                    <div style={styles.iconBox}>
                        <span style={{ fontSize: '0.8rem', position: 'absolute', marginLeft: '-25px', marginTop: '-15px', color: 'white' }}>{idx + 1}</span>
                        {r.icon}
                    </div>
                    <div style={styles.desc}>
                        <div>{r.text}</div>
                        <span style={styles.point}>{r.pt}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
