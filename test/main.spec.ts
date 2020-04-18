import { getInput, setFailed } from '@actions/core';
import { context, GitHub } from '@actions/github';
import { oneLine } from 'common-tags';

import { run } from '@minddocdev/mou-deploy-action/main';
import { deployHelm } from '@minddocdev/mou-deploy-action/lib/helm';
import { setSentryRelease } from '@minddocdev/mou-deploy-action/lib/sentry';
import {
  notifyDeploymentSuccess,
  notifyDeploymentError,
} from '@minddocdev/mou-deploy-action/lib/slack';

jest.mock('@actions/github');
jest.mock('@actions/core');
jest.mock('@minddocdev/mou-deploy-action/lib/helm');
jest.mock('@minddocdev/mou-deploy-action/lib/sentry');
jest.mock('@minddocdev/mou-deploy-action/lib/slack');

describe('run', () => {
  const configFixture = {
    app: 'myApp',
    appUrl: 'https://myapp.mydomain.localhost',
    chart: 'minddocdev/myapp',
    cluster: 'my-cluster',
    domain: 'mydomain.localhost',
    namespace: 'my-namespace',
    release: 'my-release',
    values: {
      image: {
        repositoryName: 'my-repo',
        tag: 'mytag',
      },
    },
    valueFiles: ['helm/values/myapp.yaml'],
  };
  const environment = 'staging';

  const mockInput = (
    config: string = JSON.stringify(configFixture),
    kubernetes?: string,
    helm?: string,
    sentry?: string,
    slack?: string,
    version?: string,
  ) => {
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'config':
          return config;
        case 'environment':
          return environment;
        case 'kubernetes':
          return kubernetes;
        case 'helm':
          return helm;
        case 'sentry':
          return sentry;
        case 'slack':
          return slack;
        case 'version':
          return version;
        default:
          return undefined;
      }
    });
  };

  test('does nothing only with required values', async () => {
    mockInput();
    await run();
    expect(setFailed).not.toBeCalled();
    expect(deployHelm).not.toBeCalled();
    expect(setSentryRelease).not.toBeCalled();
  });

  describe('kubernetes', () => {
    const kubernetes = oneLine`
      kind: Config
      apiVersion: v1
      clusters:
      - cluster:
          certificate-authority-data: fakeCert
          server: https://1.1.1.1
        name: my-cluster
      contexts:
      - context:
          cluster: my-cluster
          namespace: my-namespace
          user: my-user
      current-context: my-cluster
      preferences: {}
      users:
      - name: my-user
        user:
          token: fakeToken
    `;

    test('without helm config', async () => {
      const { chart, namespace, release, valueFiles, values } = configFixture;
      const chartVersion = '1.0';
      mockInput(JSON.stringify({ ...configFixture, chartVersion }), kubernetes);
      await run();
      expect(setFailed).not.toBeCalled();
      expect(deployHelm).toBeCalledWith(
        kubernetes,
        { chart, namespace, release, valueFiles, values, chartVersion },
        {},
      );
      expect(setSentryRelease).not.toBeCalled();
    });

    test('with helm config', async () => {
      const helm = {
        name: 'my-helm-repo',
        url: 'https://myrepo.localhost',
        username: 'myUser',
        password: 'myPassword',
      };
      const { chart, namespace, release, valueFiles, values } = configFixture;
      mockInput(JSON.stringify(configFixture), kubernetes, JSON.stringify(helm));
      await run();
      expect(setFailed).not.toBeCalled();
      expect(deployHelm).toBeCalledWith(
        kubernetes,
        { chart, namespace, release, valueFiles, values, chartVersion: undefined },
        helm,
      );
      expect(setSentryRelease).not.toBeCalled();
    });

    test('with error in deployment', async () => {
      mockInput(JSON.stringify(configFixture), kubernetes, undefined, undefined, undefined);
      const error = new Error('Deployment error');
      (deployHelm as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });
      await run();
      expect(setFailed).toBeCalled();
      expect(deployHelm).toBeCalled();
      expect(setSentryRelease).not.toBeCalled();
      expect(notifyDeploymentSuccess).not.toBeCalled();
      expect(notifyDeploymentError).not.toBeCalled();
    });

    describe('and slack', () => {
      const slack = 'token: myToken\nchannel: "#mychannel"';
      const expectedSlackConfig = { token: 'myToken', channel: '#mychannel' };

      test('with valid deployment', async () => {
        mockInput(JSON.stringify(configFixture), kubernetes, undefined, undefined, slack);
        await run();
        expect(setFailed).not.toBeCalled();
        expect(deployHelm).toBeCalled();
        expect(setSentryRelease).not.toBeCalled();
        expect(notifyDeploymentSuccess).toBeCalledWith(
          expect.any(GitHub),
          environment,
          configFixture.app,
          configFixture.appUrl,
          expectedSlackConfig,
        );
        expect(notifyDeploymentError).not.toBeCalled();
      });

      test('with error in deployment', async () => {
        mockInput(JSON.stringify(configFixture), kubernetes, undefined, undefined, slack);
        const error = new Error('Deployment error');
        (deployHelm as jest.Mock).mockImplementationOnce(() => { throw error; });
        await run();
        expect(setFailed).toBeCalled();
        expect(deployHelm).toBeCalled();
        expect(setSentryRelease).not.toBeCalled();
        expect(notifyDeploymentSuccess).not.toBeCalled();
        expect(notifyDeploymentError).toBeCalledWith(
          expect.any(GitHub),
          error,
          environment,
          configFixture.app,
          expectedSlackConfig,
        );
      });

      test('with wrong config', async () => {
        mockInput(
          JSON.stringify(configFixture),
          kubernetes,
          undefined,
          undefined,
          '{ "slackKey": "badConfigValue" }',
        );
        await run();
        expect(setFailed).toBeCalledWith(
          'Invalid config value for mandatory key "token". ' +
            'Found "undefined" while expecting a "string".',
        );
        expect(deployHelm).not.toBeCalled();
        expect(setSentryRelease).not.toBeCalled();
        expect(notifyDeploymentSuccess).not.toBeCalled();
        expect(notifyDeploymentError).not.toBeCalled();
      });
    });
  });

  describe('sentry', () => {
    const sentry = 'authToken: myToken\norg: myOrg';
    const expectedSentryConfig = { authToken: 'myToken', org: 'myOrg' };

    test('with version as input', async () => {
      const version = '1.0.0';
      mockInput(JSON.stringify(configFixture), undefined, undefined, sentry, undefined, version);
      await run();
      expect(setFailed).not.toBeCalled();
      expect(deployHelm).not.toBeCalled();
      expect(setSentryRelease).toBeCalledWith(
        expectedSentryConfig,
        configFixture.app,
        version,
        environment,
      );
    });

    test('with version from image tag', async () => {
      mockInput(JSON.stringify(configFixture), undefined, undefined, sentry);
      await run();
      expect(setFailed).not.toBeCalled();
      expect(deployHelm).not.toBeCalled();
      expect(setSentryRelease).toBeCalledWith(
        expectedSentryConfig,
        configFixture.app,
        configFixture.values.image.tag,
        environment,
      );
    });

    test('with version from sha context', async () => {
      context.sha = 'fakeSha';
      mockInput(JSON.stringify({ ...configFixture, values: {} }), undefined, undefined, sentry);
      await run();
      expect(setFailed).not.toBeCalled();
      expect(deployHelm).not.toBeCalled();
      expect(setSentryRelease).toBeCalledWith(
        expectedSentryConfig,
        configFixture.app,
        'fakeSha',
        environment,
      );
    });

    test('with wrong config', async () => {
      mockInput(
        JSON.stringify({ ...configFixture, values: {} }),
        undefined,
        undefined,
        '{ "sentryKey": "badConfigValue" }',
      );
      await run();
      expect(setFailed).toBeCalledWith(
        'Invalid config value for mandatory key "authToken". ' +
          'Found "undefined" while expecting a "string".',
      );
      expect(deployHelm).not.toBeCalled();
      expect(setSentryRelease).not.toBeCalled();
    });
  });

  describe('config error', () => {
    test('when could not be loaded in JSON or YAML', async () => {
      const wrongConfig = '@$%^failconfig';
      (getInput as jest.Mock).mockImplementation(() => wrongConfig);
      await run();
      expect(setFailed).toBeCalledWith(`Unable to parse config. Found content: ${wrongConfig}`);
    });

    test('when is empty', async () => {
      mockInput('');
      await run();
      expect(setFailed).toBeCalledWith('Unable to load config "undefined" into an object.');
    });

    test('when mandatory key is missing', async () => {
      mockInput('{}');
      await run();
      expect(setFailed).toBeCalledWith(
        'Invalid config value for mandatory key "app". Found "undefined" while expecting a "string".',
      );
    });

    test('when optional key has no string', async () => {
      mockInput(
        JSON.stringify({
          ...configFixture,
          namespace: 3,
        }),
      );
      await run();
      expect(setFailed).toBeCalledWith('Expecting string in "namespace" optional key. Found "3".');
    });

    test('when "valueFiles" optional key is not an array', async () => {
      mockInput(
        JSON.stringify({
          ...configFixture,
          valueFiles: 'fake',
        }),
      );
      await run();
      expect(setFailed).toBeCalledWith(
        'Expecting array in "valueFiles" optional key. Found "fake".',
      );
    });

    test('when "values" optional key is not an object', async () => {
      mockInput(
        JSON.stringify({
          ...configFixture,
          values: 'fake',
        }),
      );
      await run();
      expect(setFailed).toBeCalledWith('Expecting object in "values" optional key. Found "fake".');
    });
  });
});
