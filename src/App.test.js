import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

test('starts a typing session with the passage and configurable display options', () => {
  render(<App />);
  expect(screen.getByText(/A good typing rhythm/)).toBeInTheDocument();
  expect(screen.getByLabelText('Duration in seconds')).toHaveValue(60);
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  expect(typingArea).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  expect(typingArea).toBeEnabled();
  fireEvent.change(typingArea, { target: { value: 'A good' } });

  expect(screen.getByText('6', { selector: '.result-cell strong' })).toBeInTheDocument();
  expect(screen.getByText('100.0', { selector: '.result-cell strong' })).toBeInTheDocument();
  expect(screen.getByLabelText('Current word')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Current word'));
  expect(screen.getByLabelText('Current word')).not.toBeChecked();
});

test('starts the timer and accepts input when the user types a key in the typing area', () => {
  render(<App />);
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });

  fireEvent.keyDown(typingArea, { key: 'A' });
  expect(typingArea).toBeEnabled();
  fireEvent.change(typingArea, { target: { value: 'A' } });

  expect(typingArea).toHaveValue('A');
  expect(screen.getByText('1', { selector: '.result-cell strong' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Finish test/ })).toBeInTheDocument();
});

test('automatically finishes when the passage is complete if enabled', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'auto-finish', name: 'auto-finish.txt', text: 'lost essay' },
  ]));
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'auto-finish' } });
  fireEvent.click(screen.getByLabelText('Finish at passage end'));
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  fireEvent.change(typingArea, { target: { value: 'lost essay' } });

  expect(screen.getByText('● Complete')).toBeInTheDocument();
  expect(screen.getByText('TIME USED')).toBeInTheDocument();
  expect(typingArea).toBeDisabled();
  expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();

  unmount();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('keeps the test running at passage end when auto-finish is disabled', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'manual-finish', name: 'manual-finish.txt', text: 'done' },
  ]));
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'manual-finish' } });
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  fireEvent.change(typingArea, { target: { value: 'done' } });

  expect(screen.getByText('● Recording')).toBeInTheDocument();
  expect(typingArea).toBeEnabled();

  unmount();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('auto-finish mode is untimed and shows elapsed time instead of a countdown', () => {
  jest.useFakeTimers();
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'untimed', name: 'untimed.txt', text: 'complete' },
  ]));
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'untimed' } });
  fireEvent.click(screen.getByLabelText('Finish at passage end'));
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  jest.advanceTimersByTime(6000);

  expect(screen.getByText('TIME ELAPSED')).toBeInTheDocument();
  expect(screen.getByText('0:06')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Finish test/ })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Type the passage here' })).toBeEnabled();

  unmount();
  jest.useRealTimers();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('Enter advances to the next passage word after a partially typed word', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'skip-test', name: 'skip-test.txt', text: 'planet orbit' },
  ]));
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'skip-test' } });
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  fireEvent.change(typingArea, { target: { value: 'plane' } });
  fireEvent.keyDown(typingArea, { key: 'Enter' });
  fireEvent.change(typingArea, { target: { value: 'plane\n' } });

  const currentWord = Array.from(document.querySelectorAll('.passage-text .current-word'))
    .map((character) => character.textContent)
    .join('');
  expect(currentWord).toBe('orbit');
  expect(screen.getByText('5', { selector: '.result-cell strong' })).toBeInTheDocument();
  expect(screen.getByText('1', { selector: '.result-cell:nth-child(4) strong' })).toBeInTheDocument();
  expect(screen.getByText('83.3', { selector: '.result-cell:nth-child(3) strong' })).toBeInTheDocument();
  expect(document.querySelector('.passage-text .incorrect-character')).toHaveTextContent('t');

  unmount();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('a space advances after an incomplete word and aligns following letters to the next word', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'space-test', name: 'space-test.txt', text: 'lost essay' },
  ]));
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'space-test' } });
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  fireEvent.change(typingArea, { target: { value: 'los e' } });

  expect(document.querySelector('[data-current-word="true"]')).toHaveTextContent('e');
  expect(document.querySelector('.passage-text .incorrect-character')).toHaveTextContent('t');
  expect(screen.getByText('1', { selector: '.result-cell:nth-child(4) strong' })).toBeInTheDocument();
  expect(screen.getByText('83.3', { selector: '.result-cell:nth-child(3) strong' })).toBeInTheDocument();

  unmount();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('passage auto-scroll works when current-word highlighting is disabled', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'scroll-test', name: 'scroll-test.txt', text: 'one two three' },
  ]));
  const bounds = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBounds() {
    if (this.classList?.contains('passage-scroll')) {
      return { top: 100, bottom: 285, left: 0, right: 300, width: 300, height: 185, x: 0, y: 100, toJSON: () => ({}) };
    }
    if (this.dataset?.currentWord === 'true') {
      const isFirstWord = this.textContent === 'o';
      const top = isFirstWord ? 110 : 300;
      return { top, bottom: top + 20, left: 0, right: 10, width: 10, height: 20, x: 0, y: top, toJSON: () => ({}) };
    }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
  });
  const { unmount } = render(<App />);
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'scroll-test' } });
  const typingArea = screen.getByRole('textbox', { name: 'Type the passage here' });
  fireEvent.click(screen.getByRole('button', { name: /Start test/ }));
  fireEvent.click(screen.getByLabelText('Current word'));
  fireEvent.change(typingArea, { target: { value: 'one ' } });

  expect(screen.getByLabelText('Current word')).not.toBeChecked();
  expect(document.querySelector('.passage-scroll').scrollTop).toBeGreaterThan(0);

  unmount();
  bounds.mockRestore();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('requires confirmation before removing the selected custom passage', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'saved-one', name: 'one.txt', text: 'First passage.' },
    { id: 'saved-two', name: 'two.txt', text: 'Second passage.' },
  ]));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const { unmount } = render(<App />);

  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'saved-one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove selected passage' }));
  expect(confirm).toHaveBeenCalledWith('Remove "one.txt" from your saved passages?');
  expect(screen.getByRole('option', { name: 'one.txt' })).toBeInTheDocument();

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove selected passage' }));
  expect(screen.queryByRole('option', { name: 'one.txt' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'two.txt' })).toBeInTheDocument();

  unmount();
  confirm.mockRestore();
  window.localStorage.removeItem('nts-typing-test-passages');
});

test('requires confirmation before removing all custom passages', () => {
  window.localStorage.setItem('nts-typing-test-passages', JSON.stringify([
    { id: 'saved-one', name: 'one.txt', text: 'First passage.' },
    { id: 'saved-two', name: 'two.txt', text: 'Second passage.' },
  ]));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  const { unmount } = render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Remove all' }));
  expect(confirm).toHaveBeenCalledWith('Remove all 2 saved custom passages? This cannot be undone.');
  expect(screen.getByRole('option', { name: 'one.txt' })).toBeInTheDocument();

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove all' }));
  expect(screen.queryByRole('option', { name: 'one.txt' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'two.txt' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Daily warm-up' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove all' })).not.toBeInTheDocument();

  unmount();
  confirm.mockRestore();
  window.localStorage.removeItem('nts-typing-test-passages');
});
