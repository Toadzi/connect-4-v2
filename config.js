const config = {
    rows: 6,
    cols: 7,
    connect: 4,
    minRows: 4,
    maxRows: 9,
    minCols: 4,
    maxCols: 10,
    aiDelay: 1500,
    depth: 4,
    algorithm: 'minimax',
    mctsIterations: 750,
    colorAi: '#4caf50',
    colorPlayer: '#e91e63',
    clickLockoutPeriod: 2000,
    clickDurationRequired: 900,
    clickThreshold: 0.12,
    clickReleaseThreshold: 0.17,
    gameInstructions: `
        <p>Um die Schwierigkeit einzustellen, kannst du unterhalb vom <b>Spielfeld unten links</b> mit dem <b>Button “Depth”</b> verschiedene Stufen auswählen. Depth 1 = einfach und Depth 8 = (wahrscheinlich?) unmöglich.</p>
        <p>Du kannst unterhalb vom <b>Spielfeld unten rechts</b> mit dem <b>Button “Minimax/Negamax”</b> zwischen den zwei unterschiedlichen Algorithmen auswählen.</p>
        <p><b>Gestensteuerung</b></p>
        <p>Um mit der Gestensteuerung das Spiel zu steuern, musst du dem Browser den Zugriff auf deine Kamera erlauben.</p>
        <p>Zeige mit dem Zeigefinger in die Spalte, in der du gerne deinen Spielstein platzieren möchtest.</p>
        <p>Um das Platzieren zu bestätigen, drücke <b>deinen Daumen gegen deinen Zeigefinger</b> und halte die zwei Finger etwa 1 Sekunde zusammen, bis der Spielstein gesetzt ist.</p>
        <p>Achte darauf, dass im Sichtfeld der Kamera <b>immer nur eine Hand</b> zu sehen ist.</p>
    `
};

export default config;
