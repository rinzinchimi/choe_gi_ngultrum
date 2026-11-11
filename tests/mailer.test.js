const { createMailer, getSmtpConfig, normalizeAppPassword } = require('../config/mailer');

const validEnvironment = overrides => ({
  NODE_ENV: 'development',
  APP_BASE_URL: 'http://localhost:3000',
  GMAIL_USER: 'sender@example.com',
  GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
  ...overrides
});

describe('Gmail verification mailer', () => {
  it('uses Gmail SMTP STARTTLS and removes grouping spaces without truncating', () => {
    const smtp = getSmtpConfig(validEnvironment());

    expect(smtp).toEqual({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: {
        user: 'sender@example.com',
        pass: 'abcdefghijklmnop'
      }
    });
    expect(normalizeAppPassword('abcd efgh ijkl mnop')).toBe('abcdefghijklmnop');
  });

  it('sends to the entered recipient and reports success only when accepted', async () => {
    const callOrder = [];
    const verify = jest.fn(async () => callOrder.push('verify'));
    const sendMail = jest.fn().mockResolvedValue({
      accepted: ['Student.Name@example.com'],
      rejected: [],
      messageId: 'message-1'
    });
    sendMail.mockImplementation(async () => {
      callOrder.push('send');
      return { accepted: ['Student.Name@example.com'], rejected: [], messageId: 'message-1' };
    });
    const createTransport = jest.fn(() => ({ verify, sendMail }));
    const mailer = createMailer({
      env: validEnvironment({ APP_BASE_URL: 'https://portal.example.edu' }),
      nodemailerClient: { createTransport }
    });

    const expiresAt = new Date('2030-01-01T00:00:00Z');
    const result = await mailer.sendVerificationEmail('Student.Name@example.com', 'abc123', expiresAt);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: { user: 'sender@example.com', pass: 'abcdefghijklmnop' }
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Choe Gi Ngultrum" <sender@example.com>',
      to: 'Student.Name@example.com',
      subject: 'Verify Your Choe Gi Ngultrum Account',
      html: expect.stringContaining('Verify My Email'),
      text: expect.stringContaining('https://portal.example.edu/verify/abc123')
    }));
    expect(verify).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['verify', 'send']);
    expect(result).toMatchObject({ dev: false, delivered: true, accepted: 'Student.Name@example.com' });
  });

  it('uses the development fallback on SMTP authentication failure without logging credentials', async () => {
    const secret = 'abcdefghijklmnop';
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error(`auth failed ${secret}`), { code: 'EAUTH' }));
    const logger = { error: jest.fn(), warn: jest.fn() };
    const mailer = createMailer({
      env: validEnvironment({ GMAIL_APP_PASSWORD: secret }),
      nodemailerClient: { createTransport: () => ({ sendMail }) },
      logger
    });

    const result = await mailer.sendVerificationEmail('person@example.com', 'token-2');

    expect(result).toMatchObject({ dev: true, delivered: false, errorCode: 'EAUTH' });
    expect(result.url).toBe('http://localhost:3000/verify/token-2');
    expect(logger.error.mock.calls.flat().join(' ')).toContain('2-Step Verification');
    expect(logger.error.mock.calls.flat().join(' ')).not.toContain(secret);
    expect(logger.warn.mock.calls.flat().join(' ')).not.toContain(secret);
  });

  it('rejects incomplete app passwords before opening an SMTP transport and falls back in development', async () => {
    const createTransport = jest.fn();
    const logger = { error: jest.fn(), warn: jest.fn() };
    const mailer = createMailer({
      env: validEnvironment({ GMAIL_APP_PASSWORD: '123456789012345' }),
      nodemailerClient: { createTransport },
      logger
    });

    const result = await mailer.sendVerificationEmail('person@example.com', 'token-3');

    expect(createTransport).not.toHaveBeenCalled();
    expect(result).toMatchObject({ dev: true, delivered: false, errorCode: 'EMAIL_CONFIG_INVALID_APP_PASSWORD_LENGTH' });
    expect(logger.error.mock.calls.flat().join(' ')).toContain('complete 16-character');
  });

  it('does not treat a rejected recipient as successful delivery', async () => {
    const logger = { error: jest.fn(), warn: jest.fn() };
    const mailer = createMailer({
      env: validEnvironment(),
      nodemailerClient: {
        createTransport: () => ({
          sendMail: jest.fn().mockResolvedValue({ accepted: [], rejected: ['person@example.com'] })
        })
      },
      logger
    });

    const result = await mailer.sendVerificationEmail('person@example.com', 'token-4');
    expect(result).toMatchObject({ dev: true, delivered: false, errorCode: 'EMAIL_RECIPIENT_REJECTED' });
  });

  it('never sends real email during automated tests', async () => {
    const createTransport = jest.fn();
    const mailer = createMailer({
      env: validEnvironment({ NODE_ENV: 'test' }),
      nodemailerClient: { createTransport },
      logger: { error: jest.fn(), warn: jest.fn() }
    });

    const result = await mailer.sendVerificationEmail('person@example.com', 'test-token');
    expect(createTransport).not.toHaveBeenCalled();
    expect(result.dev).toBe(true);
  });

  it('never exposes a development link or raw SMTP details in production', async () => {
    const secret = 'abcdefghijklmnop';
    const token = 'production-token';
    const logger = { error: jest.fn(), warn: jest.fn() };
    const mailer = createMailer({
      env: validEnvironment({ NODE_ENV: 'production', GMAIL_APP_PASSWORD: secret }),
      nodemailerClient: {
        createTransport: () => ({
          verify: jest.fn().mockRejectedValue(Object.assign(new Error(`credential ${secret} ${token}`), { code: 'EAUTH' })),
          sendMail: jest.fn()
        })
      },
      logger
    });

    await expect(mailer.sendVerificationEmail('person@example.com', token)).rejects.toMatchObject({ code: 'EAUTH' });
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
