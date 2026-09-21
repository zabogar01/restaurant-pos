import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons.js';

export const PIN_LENGTH = 6; // FR-A1: six digits, numeric.

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

type PinPadProps = {
  /** Receives the entered digits on Continue. Must never log, store or echo them (B-12). */
  onSubmit: (pin: string) => void;
  /** Verification in flight: the keypad is withdrawn so nothing is submitted twice. */
  verifying?: boolean;
  /** Continue is shown but inert — the LOGIN cooldown. */
  continueDisabled?: boolean;
  /** Rendered between the entry display and the keypad, where POS-01 and M-1 put their notices. */
  children?: ReactNode;
  /**
   * Which reviewed geometry the keys take: POS-01's 88×88 (--frost-pin-*) or
   * the approval dialog's 72×72 (--frost-approval-*). A class and nothing
   * else, so both pads share one digit store and one B-12 test.
   */
  geometry?: 'lock' | 'approval';
};

/**
 * B-12 shapes this component. The digits live only in a ref: never in React
 * state, never in the DOM, never in an attribute. What renders is a *count*,
 * so the markup after entering 1-2-3 is byte-identical to the markup after
 * 9-8-7 — test/pin-pad.test.tsx holds it to that.
 */
export function PinPad({
  onSubmit,
  verifying = false,
  continueDisabled = false,
  children,
  geometry = 'lock',
}: PinPadProps) {
  const digits = useRef('');
  const [count, setCount] = useState(0);

  useEffect(
    () => () => {
      digits.current = '';
    },
    []
  );

  function press(digit: string) {
    if (digits.current.length >= PIN_LENGTH) return;
    digits.current += digit;
    setCount(digits.current.length);
  }

  function deleteLast() {
    digits.current = digits.current.slice(0, -1);
    setCount(digits.current.length);
  }

  function submit() {
    if (continueDisabled) return;
    const pin = digits.current;
    digits.current = '';
    setCount(0);
    onSubmit(pin);
  }

  // Verification only follows a complete entry, so while it is in flight the
  // display shows every position filled.
  const filled = verifying ? PIN_LENGTH : count;

  return (
    <>
      <div className="pin-dots" role="status" aria-label={`${filled} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < filled ? 'pin-dot pin-dot--filled' : 'pin-dot'} />
        ))}
      </div>

      {children}

      {!verifying && (
        <div className={geometry === 'approval' ? 'keypad keypad--approval' : 'keypad'}>
          {DIGIT_ROWS.flat().map((d) => (
            <button key={d} type="button" className="key" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="key" aria-label="Delete last digit" onClick={deleteLast}>
            <Icon name="back" />
          </button>
          <button type="button" className="key" onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className={continueDisabled ? 'key key--continue-disabled' : 'key key--continue'}
            aria-label="Continue"
            aria-disabled={continueDisabled || undefined}
            onClick={submit}
          >
            <Icon name="arrow" />
          </button>
        </div>
      )}
    </>
  );
}
