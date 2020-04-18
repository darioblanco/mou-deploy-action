import { execSync } from 'child_process';

import { setSentryRelease } from '@minddocdev/mou-deploy-action/lib/sentry';

jest.mock('@actions/core');

describe('sentry', () => {
  const authToken = 'fakeToken';
  const org = 'fakeOrg';
  const appName = 'fakeApp';
  const version = 'fakeSha';
  const environment = 'fakeEnvironment';
  const sentryCliReleases = `sentry-cli --auth-token ${authToken} releases --org ${org}`;
  const mockSentryError = (commandToFail: string) => {
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command === commandToFail) {
        throw new Error('command failed');
      }
      return 'stdout';
    });
  };

  test('set release', () => {
    setSentryRelease({ authToken, org }, appName, version, environment);
    expect(execSync).toBeCalledWith(`${sentryCliReleases} new -p ${appName} ${version}`);
    expect(execSync).toBeCalledWith(`${sentryCliReleases} set-commits --auto ${version}`);
    expect(execSync).toBeCalledWith(
      `${sentryCliReleases} deploys ${version} new -e ${environment}`,
    );
  });

  test('throw error when new release command fails', () => {
    const sentryCommand = `${sentryCliReleases} new -p ${appName} ${version}`;
    mockSentryError(sentryCommand);
    expect(() => setSentryRelease({ authToken, org }, appName, version, environment)).toThrowError(
      `Unable to prepare ${appName} sentry release`,
    );
    expect(execSync).toBeCalledWith(sentryCommand);
  });

  test('throw error when set commits command fails', () => {
    const sentryCommand = `${sentryCliReleases} set-commits --auto ${version}`;
    mockSentryError(sentryCommand);
    expect(() => setSentryRelease({ authToken, org }, appName, version, environment)).toThrowError(
      `Unable set commits for ${appName} sentry release`,
    );
    expect(execSync).toBeCalledWith(sentryCommand);
  });

  test('throw error when deploy command fails', () => {
    const sentryCommand = `${sentryCliReleases} deploys ${version} new -e ${environment}`;
    mockSentryError(sentryCommand);
    expect(() => setSentryRelease({ authToken, org }, appName, version, environment)).toThrowError(
      `Unable to deploy ${appName} to sentry`,
    );
    expect(execSync).toBeCalledWith(sentryCommand);
  });
});
