/* @vitest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Modal from '../../Modal';

describe('Modal accessibility snapshot', () => {
  it('renders an open modal with accessible attributes', () => {
    const { container } = render(
      <Modal isOpen onClose={() => {}} title="Titolo di esempio">
        <p>Contenuto di test per la verifica visiva e semantica.</p>
      </Modal>
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
