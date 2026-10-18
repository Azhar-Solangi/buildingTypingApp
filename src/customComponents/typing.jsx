import { useEffect, useRef, useState } from 'react';
import './typing.css';

const STORAGE_KEY = 'nts-typing-test-passages';
const DEFAULT_PASSAGE = 'A good typing rhythm is built one careful sentence at a time. Keep your shoulders relaxed, let your fingers return to their home position, and look ahead to the next few words instead of watching every keystroke. Accuracy gives speed a solid foundation: when a mistake happens, notice it, keep moving, and use the result to guide your next practice session. Small, steady improvements add up faster than rushed words.';

const readSavedPassages = () => {
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.text === 'string') : [];
    } catch {
        return [];
    }
};

const Typing = () => {
    const [passages, setPassages] = useState(readSavedPassages);
    const [selectedId, setSelectedId] = useState('default');
    const [duration, setDuration] = useState(60);
    const [remaining, setRemaining] = useState(60);
    const [elapsed, setElapsed] = useState(0);
    const [typedText, setTypedText] = useState('');
    const [status, setStatus] = useState('idle');
    const [autoFinishOnPassageComplete, setAutoFinishOnPassageComplete] = useState(false);
    const [highlightCurrentWord, setHighlightCurrentWord] = useState(true);
    const [highlightErrors, setHighlightErrors] = useState(true);
    const [showLiveStats, setShowLiveStats] = useState(true);
    const [uploadMessage, setUploadMessage] = useState('');
    const typingInputRef = useRef(null);
    const passageTextRef = useRef(null);

    const selectedPassage = passages.find((passage) => passage.id === selectedId);
    const passageText = selectedPassage ? selectedPassage.text : DEFAULT_PASSAGE;
    const canType = status === 'running';
    const typedProgress = [];
    const skippedPassageIndices = new Set();
    const passageWords = [];
    const passageWordPattern = /\S+/g;
    let passageWordMatch;
    while ((passageWordMatch = passageWordPattern.exec(passageText)) !== null) {
        passageWords.push({ text: passageWordMatch[0], start: passageWordMatch.index, end: passageWordPattern.lastIndex });
    }
    let passageWordIndex = 0;
    let passageWordOffset = 0;
    let hasTypedCurrentWord = false;
    for (const character of typedText.replace(/\r\n/g, '\n')) {
        if (/\s/.test(character)) {
            if (character !== '\n' && character !== '\r') {
                const currentWord = passageWords[passageWordIndex];
                const separatorIndex = currentWord?.end;
                typedProgress.push({ character, passageIndex: separatorIndex });
            }
            if (hasTypedCurrentWord) {
                const currentWord = passageWords[passageWordIndex];
                if (currentWord) {
                    for (let index = currentWord.start + passageWordOffset; index < currentWord.end; index += 1) {
                        skippedPassageIndices.add(index);
                    }
                }
                passageWordIndex += 1;
                passageWordOffset = 0;
                hasTypedCurrentWord = false;
            }
        } else {
            const currentWord = passageWords[passageWordIndex];
            const passageIndex = currentWord && passageWordOffset < currentWord.text.length
                ? currentWord.start + passageWordOffset
                : undefined;
            typedProgress.push({ character, passageIndex });
            passageWordOffset += 1;
            hasTypedCurrentWord = true;
        }
    }
    const typedCharacters = typedProgress.length;
    let correctCharacters = 0;
    const typedByPassageIndex = new Map();
    for (const typedCharacter of typedProgress) {
        if (typedCharacter.character === passageText[typedCharacter.passageIndex]) correctCharacters += 1;
        typedByPassageIndex.set(typedCharacter.passageIndex, typedCharacter.character);
    }
    const incorrectCharacters = typedCharacters - correctCharacters + skippedPassageIndices.size;
    const attemptedCharacters = typedCharacters + skippedPassageIndices.size;
    const minutes = elapsed / 60;
    const grossWpm = minutes > 0 ? typedCharacters / 5 / minutes : 0;
    const netWpm = minutes > 0 ? Math.max(0, (correctCharacters - incorrectCharacters) / 5 / minutes) : 0;
    const accuracy = attemptedCharacters > 0 ? (correctCharacters / attemptedCharacters) * 100 : 100;
    const formatScore = (score) => (score === 0 ? '0' : score.toFixed(1));
    const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(passages));
        } catch {
            setUploadMessage('Browser storage is full. Remove a saved passage before adding another.');
        }
    }, [passages]);

    useEffect(() => {
        if (!canType) return undefined;
        const timer = window.setInterval(() => {
            setElapsed((seconds) => seconds + 1);
            if (autoFinishOnPassageComplete) return;
            setRemaining((seconds) => {
                if (seconds <= 1) {
                    setStatus('finished');
                    return 0;
                }
                return seconds - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [autoFinishOnPassageComplete, canType]);

    useEffect(() => {
        if (canType) typingInputRef.current?.focus();
    }, [canType]);

    useEffect(() => {
        if (!canType) return;
        const passageContainer = passageTextRef.current;
        const currentWord = passageContainer?.querySelector('[data-current-word="true"]');
        if (!passageContainer || !currentWord) return;
        const containerBounds = passageContainer.getBoundingClientRect();
        const wordBounds = currentWord.getBoundingClientRect();
        if (wordBounds.top < containerBounds.top) {
            passageContainer.scrollTop -= containerBounds.top - wordBounds.top;
        } else if (wordBounds.bottom > containerBounds.bottom) {
            passageContainer.scrollTop += wordBounds.bottom - containerBounds.bottom;
        }
    }, [typedText, canType, passageText]);

    const startTest = () => {
        setTypedText('');
        setElapsed(0);
        setRemaining(duration);
        setStatus('running');
    };

    const finishTest = () => {
        if (status === 'running') setStatus('finished');
    };

    const startOnKeyDown = (event) => {
        if (status !== 'idle' || ['Alt', 'Control', 'Meta', 'Shift', 'Tab', 'Escape'].includes(event.key)) return;
        startTest();
    };

    const choosePassage = (event) => {
        setSelectedId(event.target.value);
        setTypedText('');
        setStatus('idle');
        setElapsed(0);
        setRemaining(duration);
    };

    const updateDuration = (event) => {
        const nextDuration = Number(event.target.value);
        if (!Number.isFinite(nextDuration) || nextDuration < 5 || nextDuration > 600) return;
        setDuration(nextDuration);
        if (status !== 'running') setRemaining(nextDuration);
    };

    const uploadPassage = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.txt')) {
            setUploadMessage('Choose a plain text (.txt) file.');
            return;
        }
        try {
            const text = (await file.text()).trim();
            if (!text) {
                setUploadMessage('That file is empty. Choose a text file with a passage.');
                return;
            }
            const passage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, text };
            setPassages((saved) => [...saved, passage]);
            setSelectedId(passage.id);
            setTypedText('');
            setElapsed(0);
            setRemaining(duration);
            setStatus('idle');
            setUploadMessage(`Saved ${file.name} in this browser.`);
        } catch {
            setUploadMessage('The file could not be read. Try another .txt file.');
        }
    };

    const deletePassage = () => {
        if (!selectedPassage) return;
        if (!window.confirm(`Remove "${selectedPassage.name}" from your saved passages?`)) return;
        setPassages((saved) => saved.filter((passage) => passage.id !== selectedId));
        setSelectedId('default');
        setTypedText('');
        setElapsed(0);
        setRemaining(duration);
        setStatus('idle');
        setUploadMessage(`Removed ${selectedPassage.name}.`);
    };

    const deleteAllPassages = () => {
        if (passages.length === 0) return;
        if (!window.confirm(`Remove all ${passages.length} saved custom passages? This cannot be undone.`)) return;
        setPassages([]);
        setSelectedId('default');
        setTypedText('');
        setElapsed(0);
        setRemaining(duration);
        setStatus('idle');
        setUploadMessage('Removed all saved custom passages.');
    };

    const currentWord = passageWords[passageWordIndex];
    const currentWordStart = currentWord?.start ?? passageText.length;
    const currentWordEnd = currentWord?.end ?? passageText.length;
    const lastPassageWord = passageWords[passageWords.length - 1];
    const passageComplete = passageWords.length > 0 && (
        passageWordIndex >= passageWords.length ||
        (passageWordIndex === passageWords.length - 1 && passageWordOffset >= lastPassageWord.text.length)
    );

    useEffect(() => {
        if (canType && autoFinishOnPassageComplete && passageComplete) setStatus('finished');
    }, [autoFinishOnPassageComplete, canType, passageComplete]);

    return (
        <main className="typing-shell">
            <header className="topbar">
                <a className="brand" href="/" aria-label="Keystep home"><span className="brand-mark">AS</span> AzharSolangi</a>
                <span className="topbar-note">A small practice, a sharper rhythm.</span>
            </header>

            <section className="test-heading" aria-labelledby="page-title">
                <div>
                    <p className="eyebrow">PRACTICE SESSION</p>
                    <h1 id="page-title">Find your flow.</h1>
                </div>
                <div className="session-clock" aria-live="polite">
                    <span className="clock-label">
                        {status === 'running' && autoFinishOnPassageComplete ? 'TIME ELAPSED' : status === 'running' ? 'TIME LEFT' : status === 'finished' ? 'TIME USED' : 'SESSION TIME'}
                    </span>
                    <strong>
                        {formatTime(status === 'running' && autoFinishOnPassageComplete ? elapsed : status === 'running' ? remaining : status === 'finished' ? elapsed : duration)}
                    </strong>
                    <label className="auto-finish-toggle" title="Automatically finish when you reach the end of this passage">
                        <input type="checkbox" checked={autoFinishOnPassageComplete} onChange={(event) => setAutoFinishOnPassageComplete(event.target.checked)} />
                        <span>Finish at passage end</span>
                    </label>
                </div>
            </section>

            <section className="control-bar" aria-label="Test settings">
                <label className="field-group passage-choice">
                    <span>Passage</span>
                    <select aria-label="Passage" value={selectedId} onChange={choosePassage} disabled={canType}>
                        <option value="default">Daily warm-up</option>
                        {passages.map((passage) => <option key={passage.id} value={passage.id}>{passage.name}</option>)}
                    </select>
                </label>
                {selectedPassage && <button className="icon-button remove-passage" type="button" onClick={deletePassage} disabled={canType} aria-label="Remove selected passage" title="Remove selected passage">×</button>}
                {passages.length > 0 && <button className="remove-all-button" type="button" onClick={deleteAllPassages} disabled={canType}>Remove all</button>}
                <label className="field-group duration-choice">
                    <span>Duration</span>
                    <span className="number-control"><input aria-label="Duration in seconds" type="number" min="5" max="600" step="5" value={duration} onChange={updateDuration} disabled={canType || autoFinishOnPassageComplete} /><span>{autoFinishOnPassageComplete ? 'unused' : 'sec'}</span></span>
                </label>
                <label className="upload-button" title="Upload a plain text file">
                    <span aria-hidden="true">＋</span> Add text
                    <input type="file" accept=".txt,text/plain" onChange={uploadPassage} disabled={canType} />
                </label>
                <button className="start-button" type="button" onClick={canType ? finishTest : startTest}>
                    {canType ? 'Finish test' : status === 'finished' ? 'Try again' : 'Start test'}
                    <span aria-hidden="true">{canType ? '■' : '↗'}</span>
                </button>
            </section>
            {uploadMessage && <p className="upload-message" role="status">{uploadMessage}</p>}

            <section className="passage-panel" aria-labelledby="passage-label">
                <div className="panel-heading">
                    <div><span className="panel-kicker">READ THE PASSAGE</span><span id="passage-label" className="passage-name">{selectedPassage?.name || 'Daily warm-up'}</span></div>
                    <span className="character-count">{passageText.length.toLocaleString()} characters</span>
                </div>
                <div className="passage-scroll" ref={passageTextRef}>
                    <p className="passage-text" aria-label="Passage to type">
                    {Array.from(passageText).map((character, index) => {
                        const isCurrentWord = index >= currentWordStart && index < currentWordEnd;
                        const typedCharacter = typedByPassageIndex.get(index);
                        const isTyped = typedByPassageIndex.has(index);
                        const isSkipped = skippedPassageIndices.has(index);
                        const isIncorrect = isSkipped || (isTyped && typedCharacter !== character);
                        const className = [
                            highlightCurrentWord && canType && isCurrentWord ? 'current-word' : '',
                            highlightErrors && isIncorrect ? 'incorrect-character' : '',
                            isTyped && !isIncorrect ? 'correct-character' : '',
                        ].filter(Boolean).join(' ');
                        return <span className={className} data-current-word={canType && index === currentWordStart ? 'true' : undefined} key={`${index}-${character}`}>{character}</span>;
                    })}
                    </p>
                </div>
            </section>

            <section className={`typing-panel ${canType ? 'is-active' : ''}`} aria-labelledby="typing-label">
                <div className="panel-heading typing-heading">
                    <div><span className="panel-kicker">YOUR TURN</span><label id="typing-label" htmlFor="typing-input" className="passage-name">Type the passage below</label></div>
                    <span className={`status-indicator status-${status}`}>{status === 'running' ? '● Recording' : status === 'finished' ? '● Complete' : '● Ready'}</span>
                </div>
                <textarea id="typing-input" ref={typingInputRef} aria-label="Type the passage here" placeholder={status === 'running' ? 'Start typing here...' : status === 'idle' ? 'Type here to start, or use the Start test button.' : 'Test complete. Start a new test to continue.'} value={typedText} onKeyDown={startOnKeyDown} onChange={(event) => { if (status === 'running') setTypedText(event.target.value); }} disabled={status === 'finished'} spellCheck="false" autoCapitalize="off" autoComplete="off" />
                {status === 'finished' && <p className="result-notice" role="status">Time is up. Your results are based on this passage and this attempt.</p>}
            </section>

            <section className="results-strip" aria-label="Typing results" aria-live="polite">
                <div className="result-cell primary-result"><span>NET SPEED</span><strong>{formatScore(netWpm)} <small>WPM</small></strong></div>
                <div className="result-cell"><span>GROSS SPEED</span><strong>{formatScore(grossWpm)} <small>WPM</small></strong></div>
                <div className="result-cell"><span>ACCURACY</span><strong>{accuracy.toFixed(1)}<small>%</small></strong></div>
                <div className="result-cell"><span>ERRORS</span><strong>{incorrectCharacters.toLocaleString()}</strong></div>
                <div className="result-cell"><span>CHARACTERS</span><strong>{typedCharacters.toLocaleString()}<small> / {passageText.length.toLocaleString()}</small></strong></div>
            </section>

            <section className="preferences" aria-label="Display options">
                <span className="preferences-title">DISPLAY</span>
                <label><input type="checkbox" checked={highlightCurrentWord} onChange={(event) => setHighlightCurrentWord(event.target.checked)} /> Current word</label>
                <label><input type="checkbox" checked={highlightErrors} onChange={(event) => setHighlightErrors(event.target.checked)} /> Mark errors</label>
                <label><input type="checkbox" checked={showLiveStats} onChange={(event) => setShowLiveStats(event.target.checked)} /> Live results</label>
            </section>
            {!showLiveStats && canType && <p className="stats-hidden-note">Live results are hidden. They will appear when the test ends.</p>}
        </main>
    );
};

export default Typing;