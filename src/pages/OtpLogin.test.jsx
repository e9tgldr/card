import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { authStoreMock, notifyMocks } = vi.hoisted(() => ({
  authStoreMock: {
    checkInviteCode: vi.fn(),
    registerWithCode: vi.fn(),
    login: vi.fn(),
    currentSession: vi.fn().mockReturnValue(null),
    bootstrapCode: vi.fn().mockResolvedValue(null),
  },
  notifyMocks: {
    error: vi.fn(), success: vi.fn(), info: vi.fn(),
    loading: vi.fn(), promise: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn(),
  },
}));
vi.mock('@/lib/authStore', () => authStoreMock);
vi.mock('@/lib/feedback', () => ({ notify: notifyMocks }));
vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'mn', setLang: vi.fn() }) };
});

import OtpLogin from './OtpLogin';

const renderPage = () => render(
  <MemoryRouter><OtpLogin /></MemoryRouter>,
);

beforeEach(() => {
  authStoreMock.checkInviteCode.mockReset();
  authStoreMock.registerWithCode.mockReset();
  authStoreMock.login.mockReset();
  Object.values(notifyMocks).forEach((m) => m.mockClear?.());
});

afterEach(() => { cleanup(); });

describe('OtpLogin — claim hint', () => {
  it('shows the claim hint when next param starts with /c/', () => {
    render(
      <MemoryRouter initialEntries={['/otp?next=%2Fc%2F1']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Бүртгэгдсэний дараа карт/i)).toBeInTheDocument();
  });

  it('does not show the claim hint without the next param', () => {
    render(
      <MemoryRouter initialEntries={['/otp']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Бүртгэгдсэний дараа карт/i)).toBeNull();
  });
});

describe('OtpLogin — device conflict + eviction banner', () => {
  it('renders the device-conflict dialog when login returns device_conflict', async () => {
    authStoreMock.login.mockResolvedValueOnce({
      ok: false,
      reason: 'device_conflict',
      device_label: 'Chrome on Windows',
      last_seen: new Date(Date.now() - 3 * 60_000).toISOString(),
    });

    render(
      <MemoryRouter initialEntries={['/otp?next=/app']}>
        <OtpLogin />
      </MemoryRouter>,
    );

    // Switch to login mode.
    fireEvent.click(screen.getByText('Нэвтрэх'));
    // Fill credentials.
    fireEvent.change(screen.getAllByPlaceholderText('ner')[0], { target: { value: 'alice' } });
    fireEvent.change(screen.getAllByPlaceholderText('********')[0], { target: { value: 'pw1234' } });
    // Click the submit button (last "Нэвтрэх" button).
    const navAndSubmit = screen.getAllByRole('button', { name: /Нэвтрэх/ });
    fireEvent.click(navAndSubmit[navAndSubmit.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('auth.deviceConflictTitle')).toBeInTheDocument();
    });
    // The conflict body key is rendered (t mock returns key strings).
    expect(screen.getByText('auth.deviceConflictBody')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.takeOverButton' }))
      .toBeInTheDocument();
  });

  it('clicking takeover calls login with force=true', async () => {
    authStoreMock.login
      .mockResolvedValueOnce({
        ok: false, reason: 'device_conflict',
        device_label: 'Chrome on Windows', last_seen: new Date().toISOString(),
      })
      .mockResolvedValueOnce({ ok: true, account: { username: 'alice' } });

    render(
      <MemoryRouter initialEntries={['/otp?next=/app']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Нэвтрэх'));
    fireEvent.change(screen.getAllByPlaceholderText('ner')[0], { target: { value: 'alice' } });
    fireEvent.change(screen.getAllByPlaceholderText('********')[0], { target: { value: 'pw1234' } });
    const navAndSubmit = screen.getAllByRole('button', { name: /Нэвтрэх/ });
    fireEvent.click(navAndSubmit[navAndSubmit.length - 1]);

    const takeover = await screen.findByRole('button', { name: 'auth.takeOverButton' });
    fireEvent.click(takeover);

    await waitFor(() => {
      expect(authStoreMock.login).toHaveBeenLastCalledWith({
        username: 'alice', password: 'pw1234', force: true,
      });
    });
  });

  it('shows eviction banner when ?reason=signed_in_elsewhere is present', async () => {
    render(
      <MemoryRouter initialEntries={['/otp?reason=signed_in_elsewhere']}>
        <OtpLogin />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText('auth.evictedBanner')
    ).toBeInTheDocument();
  });
});

describe('OtpLogin polish', () => {
  it('error message has role=alert and aria-live=assertive', async () => {
    authStoreMock.login.mockResolvedValue({ ok: false, reason: 'bad_password' });
    renderPage();
    fireEvent.click(screen.getByText('Нэвтрэх')); // tab toggle
    const usernameInput = screen.getAllByPlaceholderText('ner')[0];
    const pwInput = screen.getAllByPlaceholderText('********')[0];
    fireEvent.change(usernameInput, { target: { value: 'u' } });
    fireEvent.change(pwInput, { target: { value: 'wrong' } });
    // Two buttons match "Нэвтрэх": the tab toggle and the submit. Pick the last (submit).
    const navAndSubmit = screen.getAllByRole('button', { name: /Нэвтрэх/ });
    fireEvent.click(navAndSubmit[navAndSubmit.length - 1]);
    await waitFor(() => {
      const errorEl = screen.getByText(/Нууц үг буруу/);
      expect(errorEl).toHaveAttribute('role', 'alert');
      expect(errorEl).toHaveAttribute('aria-live', 'assertive');
    });
  });

  it('password show/hide toggle reveals plaintext', () => {
    renderPage();
    fireEvent.click(screen.getByText('Нэвтрэх'));
    const pw = screen.getAllByPlaceholderText('********')[0];
    expect(pw).toHaveAttribute('type', 'password');
    const toggle = screen.getByLabelText(/харах|нуух/);
    fireEvent.click(toggle);
    expect(pw).toHaveAttribute('type', 'text');
  });

  it('fires success toast before navigate on login', async () => {
    authStoreMock.login.mockResolvedValue({ ok: true });
    renderPage();
    fireEvent.click(screen.getByText('Нэвтрэх'));
    const usernameInput = screen.getAllByPlaceholderText('ner')[0];
    const pwInput = screen.getAllByPlaceholderText('********')[0];
    fireEvent.change(usernameInput, { target: { value: 'u' } });
    fireEvent.change(pwInput, { target: { value: 'p' } });
    // Two buttons match "Нэвтрэх": the tab toggle and the submit. Pick the last (submit).
    const navAndSubmit = screen.getAllByRole('button', { name: /Нэвтрэх/ });
    fireEvent.click(navAndSubmit[navAndSubmit.length - 1]);
    await waitFor(() => expect(notifyMocks.success).toHaveBeenCalledWith('toast.auth.loginSuccess'));
  });
});
