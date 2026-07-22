import { render, screen, waitFor, within } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import CountryInput from './CountryInput';

describe('CountryInput', () => {
  const defaultProps = {
    onFormSubmit: vi.fn((e) => e.preventDefault()),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the input field with placeholder', () => {
    render(<CountryInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<CountryInput {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(b => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeTruthy();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<CountryInput {...defaultProps} disabled={true} />);
    expect(screen.getByPlaceholderText('Country')).toBeDisabled();
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(b => b.getAttribute('type') === 'submit');
    expect(submitButton).toBeDisabled();
  });

  it('shows suggestions when typing a matching prefix', async () => {
    render(<CountryInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'Fra');
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('button');
      const franceItem = items.find(item => item.textContent === 'France');
      expect(franceItem).toBeTruthy();
    });
  });

  it('hides suggestions when input is cleared', async () => {
    render(<CountryInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'Fra');
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
    await userEvent.clear(input);
    await waitFor(() => {
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  it('selects a suggestion on click', async () => {
    render(<CountryInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'Ger');
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('button');
    await userEvent.click(items[0]);
    expect(input).toHaveValue('Germany');
  });

  it('navigates suggestions with arrow keys', async () => {
    render(<CountryInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'Br');
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('button');
    expect(items.length).toBeGreaterThan(0);
    // Navigate down
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const selectedItems = within(list).getAllByRole('button');
      expect(selectedItems[0]).toHaveClass('Mui-selected');
    });
  });

  it('clears input after form submission', async () => {
    const onFormSubmit = vi.fn((e) => e.preventDefault());
    render(<CountryInput {...defaultProps} onFormSubmit={onFormSubmit} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'France');
    expect(input).toHaveValue('France');

    const buttons = screen.getAllByRole('button');
    const submitButton = buttons.find(b => b.getAttribute('type') === 'submit')!;
    await userEvent.click(submitButton);

    expect(input).toHaveValue('');
    expect(onFormSubmit).toHaveBeenCalled();
  });

  it('closes suggestions on Escape key', async () => {
    render(<CountryInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('Country');
    await userEvent.type(input, 'Bra');
    await waitFor(() => {
      expect(screen.getByRole('list')).toBeInTheDocument();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });
});
