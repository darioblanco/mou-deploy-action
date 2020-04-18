import { oneLine } from 'common-tags';
import { execSync } from 'child_process';
import * as fs from 'fs';

import { deployHelm } from '@minddocdev/mou-deploy-action/lib/helm';

jest.mock('fs', () => ({
  writeFileSync: jest.fn(() => {}),
}));

jest.mock('@actions/core');

describe('helm', () => {
  const kubeConfig = 'kubeConfig';
  const mockHelmError = (commandToFail: string) => {
    (execSync as jest.Mock).mockImplementation((command: string) => {
      if (command === commandToFail) {
        throw new Error('command failed');
      }
      return 'stdout';
    });
  };

  beforeEach(jest.clearAllMocks);

  test('without repo config', () => {
    const deployConfig = {
      chart: 'myChart',
      chartVersion: '1.0.0',
      namespace: 'default',
      release: 'myRelease',
      valueFiles: ['myFile1'],
      values: { config: { fakeEntry: 'lol' } },
    };
    const { namespace, release, chart, values } = deployConfig;
    deployHelm(kubeConfig, deployConfig, {});
    expect(fs.writeFileSync).toBeCalledWith('./kubeconfig.yaml', kubeConfig);
    expect(execSync).toBeCalledWith(`helm ls -n ${namespace}`);
    expect(execSync).toBeCalledWith(`kubectl get all -n ${namespace}`);
    expect(fs.writeFileSync).toBeCalledWith(
      './loaded-values.yaml',
      JSON.stringify(values),
    );
    expect(execSync).not.toBeCalledWith('helm repo update');
    expect(execSync).toBeCalledWith(oneLine`
      helm upgrade
      --install
      --wait
      --namespace ${namespace}
      -f myFile1 -f ./loaded-values.yaml
      --version 1.0.0
      ${release} ${chart}
    `);
  });

  test('with repo config', () => {
    const deployConfig = {
      chart: 'myChart',
      namespace: 'default',
      release: 'myRelease',
      valueFiles: [],
      values: { config: { fakeEntry: 'lol' } },
    };
    const helmRepo = {
      name: 'fakeRepo',
      url: 'https://fakeRepo',
      username: 'fakeUser',
      password: 'fakePassword',
    };
    const { namespace, release, chart, values } = deployConfig;
    deployHelm(kubeConfig, deployConfig, helmRepo);
    expect(fs.writeFileSync).toBeCalledWith('./kubeconfig.yaml', kubeConfig);
    expect(execSync).toBeCalledWith(`helm ls -n ${namespace}`);
    expect(execSync).toBeCalledWith(`kubectl get all -n ${namespace}`);
    expect(fs.writeFileSync).toBeCalledWith('./loaded-values.yaml', JSON.stringify(values));
    expect(execSync).toBeCalledWith(oneLine`
      helm repo add
        --username ${helmRepo.username}
        --password ${helmRepo.password}
        ${helmRepo.name}
        ${helmRepo.url}
    `);
    expect(execSync).toBeCalledWith('helm repo update');
    expect(execSync).toBeCalledWith(oneLine`
      helm upgrade
      --install
      --wait
      --namespace ${namespace}
      -f ./loaded-values.yaml
      ${release} ${chart}
    `);
  });

  test('throw error when add repository command fails', () => {
    const deployConfig = {
      chart: 'myChart',
      namespace: 'default',
      release: 'myRelease',
      valueFiles: [],
      values: { config: { fakeEntry: 'lol' } },
    };
    const helmRepo = {
      name: 'fakeRepo',
      url: 'https://fakeRepo'
    };
    const errorCommand = `helm repo add ${helmRepo.name} ${helmRepo.url}`;
    mockHelmError(errorCommand);
    expect(() => deployHelm(kubeConfig, deployConfig, helmRepo)).toThrowError(
      `Unable to add repository ${helmRepo.name} with url ${helmRepo.url}`,
    );
    expect(execSync).toBeCalledWith(errorCommand);
  });

  test('throw error when repository update command fails', () => {
    const deployConfig = {
      chart: 'myChart',
      namespace: 'default',
      release: 'myRelease',
      valueFiles: [],
      values: { config: { fakeEntry: 'lol' } },
    };
    const helmRepo = {
      name: 'fakeRepo',
      url: 'https://fakeRepo',
    };
    const errorCommand = 'helm repo update';
    mockHelmError(errorCommand);
    expect(() => deployHelm(kubeConfig, deployConfig, helmRepo)).toThrowError(
      'Unable to update repositories',
    );
    expect(execSync).toBeCalledWith(errorCommand);
  });

  test('throw error when upgrade command fails', () => {
    const deployConfig = {
      chart: 'myChart',
      namespace: 'default',
      release: 'myRelease',
      valueFiles: [],
      values: { config: { fakeEntry: 'lol' } },
    };
    const { namespace, release, chart } = deployConfig;
    const errorCommand = oneLine`
      helm upgrade
      --install
      --wait
      --namespace ${namespace}
      -f ./loaded-values.yaml
      ${release} ${chart}
    `;
    mockHelmError(errorCommand);
    expect(() => deployHelm(kubeConfig, deployConfig, {})).toThrowError(
      `Unable to deploy ${chart} chart with release ${release}`,
    );
    expect(execSync).toBeCalledWith(errorCommand);
  });
});
