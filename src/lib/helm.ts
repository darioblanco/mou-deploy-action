import * as core from '@actions/core';
import { oneLine } from 'common-tags';
import * as fs from 'fs';
import { execSync } from 'child_process';

function createKubeConfig(kubeConfig: string) {
  process.env.KUBECONFIG = './kubeconfig.yaml';
  fs.writeFileSync(process.env.KUBECONFIG, kubeConfig);
  core.info(`Created kubernetes config in ${process.env.KUBECONFIG}`);
}

function createHelmValuesFile(path: string, values: {}) {
  core.debug(`Parsing values '${values}'...`);
  fs.writeFileSync(path, JSON.stringify(values));
  core.info(`Created values file from provided values in ${path}`);
}

function addHelmRepo(name: string, url: string, username?: string, password?: string) {
  core.startGroup('Add helm repository');
  const loginString = username && password ? `--username ${username} --password ${password} ` : '';
  const addCommand = `helm repo add ${loginString}${name} ${url}`;
  core.info(addCommand);
  try {
    core.info(execSync(addCommand).toString());
  } catch (error) {
    throw new Error(`Unable to add repository ${name} with url ${url}`);
  }
  const updateCommand = 'helm repo update';
  core.info(updateCommand);
  try {
    core.info(execSync(updateCommand).toString());
  } catch (error) {
    throw new Error('Unable to update repositories');
  }
  core.endGroup();
}

function setupHelmChart(
  namespace: string,
  release: string,
  chart: string,
  valueFiles: string[],
  chartVersion?: string,
) {
  core.startGroup(`Deploy ${chart} chart with release ${release}`);
  const versionString = chartVersion ? `--version ${chartVersion}` : '';
  const valueFilesString = valueFiles
    .map(valueFile => `-f ${valueFile}`)
    .join(' ');
  const command = oneLine`
    helm upgrade
      --install
      --wait
      --namespace ${namespace}
      ${valueFilesString}
      ${versionString}
      ${release}
      ${chart}
  `;
  core.info(command);
  try {
    core.info(execSync(command).toString());
  } catch (error) {
    throw new Error(`Unable to deploy ${chart} chart with release ${release}`);
  }
  core.endGroup();
}

export function deployHelm(
  kubeConfig: string,
  { chart, chartVersion, release, namespace, valueFiles, values }: {
    chart: string;
    chartVersion?: string;
    namespace: string;
    release: string;
    valueFiles: string[];
    values: {};
  },
  { name, url, username, password }: {
    name?: string;
    url?: string;
    username?: string;
    password?: string;
  },
) {
  createKubeConfig(kubeConfig);

  core.startGroup('Configured namespace information');
  core.info(execSync(`helm ls -n ${namespace}`).toString());
  core.info(execSync(`kubectl get all -n ${namespace}`).toString());
  core.endGroup();

  const loadedValuesPath = './loaded-values.yaml';
  createHelmValuesFile(loadedValuesPath, values);
  valueFiles.push(loadedValuesPath);

  if (name && url) {
    addHelmRepo(name, url, username, password);
  } else {
    core.info('No repo was provided. Skipping repo addition');
  }

  setupHelmChart(namespace, release, chart, valueFiles, chartVersion);
}
