import * as core from '@actions/core';
import { context, GitHub } from '@actions/github';
import { oneLine } from 'common-tags';
import * as yaml from 'js-yaml';

import { deployHelm } from './lib/helm';
import { setSentryRelease, SentryConfig } from './lib/sentry';
import { notifyDeploymentSuccess, notifyDeploymentError, SlackConfig } from './lib/slack';

interface RequiredConfig {
  app: string;
  appUrl: string;
  chart: string;
}

interface OptionalConfig extends RequiredConfig {
  chartVersion?: string;
  namespace?: string;
  release?: string;
  valueFiles?: string[];
  values?: { [key: string]: any };
}

interface Config extends RequiredConfig, OptionalConfig {
  namespace: string;
  release: string;
  valueFiles: string[];
  values: { [key: string]: any };
}

function parseConfig(rawConfig: string) {
  core.debug(`Parsing raw config '${rawConfig}'...`);
  let config: { [key: string]: any };
  try {
    // Try JSON first
    config = JSON.parse(rawConfig);
  } catch (jsonError) {
    // Might be in YAML format
    try {
      config = yaml.safeLoad(rawConfig);
    } catch (yamlError) {
      throw new Error(`Unable to parse config. Found content: ${rawConfig}`);
    }
  }
  if (!config || typeof config !== 'object') {
    throw new Error(`Unable to load config "${config}" into an object.`);
  }
  return config;
}

function validateConfig(): Config {
  const rawConfig = core.getInput('config', { required: true });
  core.debug(`Parsing raw config '${rawConfig}'...`);
  const config = parseConfig(rawConfig) as OptionalConfig;
  // Check loaded types
  ['app', 'appUrl', 'chart'].forEach(requiredKey => {
    const requiredValue = config[requiredKey];
    if (!requiredValue || typeof requiredValue !== 'string') {
      throw new Error(oneLine`
        Invalid config value for mandatory key "${requiredKey}".
        Found "${requiredValue}" while expecting a "string".
      `);
    }
  });
  ['namespace', 'release'].forEach(optionalKey => {
    if (config[optionalKey] && typeof config[optionalKey] !== 'string') {
      throw new Error(oneLine`
        Expecting string in "${optionalKey}" optional key.
        Found "${config[optionalKey]}".
      `);
    }
  });
  if (config.valueFiles && !Array.isArray(config.valueFiles)) {
    throw new Error(oneLine`
      Expecting array in "valueFiles" optional key.
      Found "${config.valueFiles}".
    `);
  }
  if (config.values && !(typeof config.values === 'object')) {
    throw new Error(oneLine`
      Expecting object in "values" optional key.
      Found "${config.values}".
    `);
  }
  return {
    namespace: 'default',
    release: config.app,
    valueFiles: [],
    values: {},
    ...config,
  };
}

function validateSentry(rawSentry: string) {
  core.debug(`Parsing sentry config '${rawSentry}'...`);
  const sentry = parseConfig(rawSentry) as SentryConfig;
  // Check loaded types
  ['authToken', 'org'].forEach(requiredKey => {
    const requiredValue = sentry[requiredKey];
    if (!requiredValue || typeof requiredValue !== 'string') {
      throw new Error(oneLine`
        Invalid config value for mandatory key "${requiredKey}".
        Found "${requiredValue}" while expecting a "string".
      `);
    }
  });
  return sentry;
}

function validateSlack(rawSlack: string) {
  core.debug(`Parsing slack config '${rawSlack}'...`);
  const slack = parseConfig(rawSlack) as SlackConfig;
  // Check loaded types
  ['token', 'channel'].forEach(requiredKey => {
    const requiredValue = slack[requiredKey];
    if (!requiredValue || typeof requiredValue !== 'string') {
      throw new Error(oneLine`
        Invalid config value for mandatory key "${requiredKey}".
        Found "${requiredValue}" while expecting a "string".
      `);
    }
  });
  return slack;
}

export async function run() {
  try {
    // Deployment variables
    const config = validateConfig();
    const { app, appUrl, chart, chartVersion, namespace, release, valueFiles, values } = config;
    const environment = core.getInput('environment', { required: true });

    // Kubernetes variables
    const kubernetes = core.getInput('kubernetes', { required: false });

    // Sentry config
    const rawSentry = core.getInput('sentry', { required: false });
    const sentry = rawSentry ? validateSentry(rawSentry) : null;

    // Slack config
    const rawSlack = core.getInput('slack', { required: false });
    const slack = rawSlack ? validateSlack(rawSlack) : null;

    // Github client
    const client = new GitHub(core.getInput('token', { required: true }));

    core.debug('Loaded variables:');
    core.debug(`- app: ${app}`);
    core.debug(`- appUrl: ${appUrl}`);
    core.debug(`- environment: ${environment}`);
    core.debug(`- namespace: ${namespace}`);
    core.debug(`- release: ${release}`);
    core.debug(`- valueFiles: ${valueFiles}`);
    core.debug(`- values: ${JSON.stringify(values)}`);

    core.debug(`- kubernetes: ${kubernetes}`);
    core.debug(`- sentry: ${JSON.stringify(sentry)}`);
    core.debug(`- slack: ${JSON.stringify(slack)}`);

    // Deploy with Helm
    if (chart && kubernetes) {
      const rawHelm = core.getInput('helm', { required: false });
      const helm = rawHelm ? parseConfig(rawHelm) : {};
      core.debug(`- helm: ${helm}`);
      try {
        deployHelm(
          kubernetes,
          { chart, chartVersion, namespace, release, valueFiles, values },
          helm,
        );
        if (slack) {
          await notifyDeploymentSuccess(client, environment, app, appUrl, slack);
        }
      } catch (error) {
        if (slack) {
          await notifyDeploymentError(
            client,
            error,
            environment,
            app,
            slack,
          );
        }
        throw error;
      }
    } else {
      core.warning('No kubernetes config was provided. Skipping kubernetes helm deployment');
    }

    // Update Sentry
    if (sentry) {
      const { authToken, org } = sentry;
      let version = core.getInput('version', { required: false });
      if (!version) {
        version = values.image && values.image.tag ? values.image.tag : context.sha;
      }
      setSentryRelease({ authToken, org }, app, version, environment);
    } else {
      core.warning('No sentry config was provided. Skipping sentry release');
    }

    // Send Slack notification
    // if (slackWebhook) {
    //   sendSlackMessage(
    //     `${context.repo.owner}/${context.repo.repo}`,
    //     context.ref,
    //     context.actor,
    //     app,
    //     appUrl,
    //     context.sha,
    //     release,
    //     slackWebhook,
    //     sentryOrg,
    //   );
    // } else {
    //   core.info('No slack webhook was provided. Skipping slack message notification');
    // }
  } catch (error) {
    core.setFailed(error.message);
  }
}
