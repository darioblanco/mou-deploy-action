import * as core from '@actions/core';
import { execSync } from 'child_process';

export interface SentryConfig {
  authToken: string;
  org: string;
}

export function setSentryRelease(
  { authToken, org }: SentryConfig,
  appName: string,
  version: string,
  environment: string,
) {
  core.info(`Set up sentry release for ${environment}`);
  const sentryCliReleases = `sentry-cli --auth-token ${authToken} releases --org ${org}`;
  const newReleaseCommand = `${sentryCliReleases} new -p ${appName} ${version}`;
  core.info(newReleaseCommand);
  try {
    execSync(newReleaseCommand);
  } catch (error) {
    throw new Error(`Unable to prepare ${appName} sentry release`);
  }
  const setCommitsCommand = `${sentryCliReleases} set-commits --auto ${version}`;
  core.info(setCommitsCommand);
  try {
    execSync(setCommitsCommand);
  } catch (error) {
    throw new Error(`Unable set commits for ${appName} sentry release`);
  }
  const deployCommand = `${sentryCliReleases} deploys ${version} new -e ${environment}`;
  core.info(deployCommand);
  try {
    execSync(deployCommand);
  } catch (error) {
    throw new Error(`Unable to deploy ${appName} to sentry`);
  }
}
