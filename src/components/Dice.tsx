
import React from 'react';
import styles from './Dice.module.css';
import type { DieValue } from '../game/types';
import { ITEM_MAPPING } from '../game/validation';

interface DiceProps {
    value: DieValue;
    selected?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    label?: string;
}

const ICONS: Record<string, string> = {
    House: '🏠',
    Yarn: '🧶',
    Butterfly: '🦋',
    Bowl: '🥣',
    Cushion: '🛋️',
    Mouse: '🐭'
};

export const Dice: React.FC<DiceProps> = ({ value, selected, onClick, disabled, label }) => {
    const itemType = ITEM_MAPPING[value];

    return (
        <div
            className={`${styles.die} ${selected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
            onClick={!disabled ? onClick : undefined}
        >
            <div className={styles.value}>{value}</div>
            <div className={styles.icon}>{ICONS[itemType]}</div>
            {label && <div className={styles.label}>{label}</div>}
        </div>
    );
};
