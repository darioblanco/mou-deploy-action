import { oneLine, oneLineTrim } from 'common-tags';
import { context } from '@actions/github';
import { WebClient } from '@slack/web-api';

import {
  notifyDeploymentSuccess, notifyDeploymentError,
} from '@minddocdev/mou-deploy-action/lib/slack';

jest.mock('@actions/core');
jest.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'myOwner', repo: 'myRepo' },
  },
}));
jest.mock('@slack/web-api');

describe('slack', () => {
  const repositoryPayload: any = {
    html_url: 'https://github.com/Codertocat/Hello-World',
  };
  const commitData = {
    author: {
      login: 'octocat',
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      html_url: 'https://github.com/octocat',
    },
    commit: {
      message: 'Fix all the bugs',
      author: {
        name: 'Monalisa Octoca',
      },
    },
    html_url:
      'https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e',
  };
  const postMessage = jest.fn(() => ({ response_metadata: 'fake' }));
  (WebClient as any).mockImplementation(() => {
    return { chat: { postMessage } };
  });

  const getCommit = jest.fn(() => ({ data: commitData }));

  test('notify deployment success ', async () => {
    context.payload = {
      deployment: {
        sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
        ref: 'master',
        id: 145988746,
      },
      repository: repositoryPayload,
    };
    const getReleaseByTag = jest.fn(() => ({
      data: {
        html_url: 'https://github.com/octocat/Hello-World/releases/v1.0.0',
        body: 'Description of the release',
      },
    }));
    const github = { repos: { getCommit, getReleaseByTag } };
    await notifyDeploymentSuccess(
      github as any,
      'production',
      'myapp',
      'http://url',
      { token: 'fakeToken', channel: 'fakeChannel' },
    );
    expect(postMessage.mock.calls[0]).toMatchSnapshot();
  });

  test('notify deployment error ', async () => {
    context.payload = {
      deployment: {
        sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
        ref: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
        id: 145988746,
      },
    };
    const getReleaseByTag = jest.fn(() => { throw new Error(); });
    const github = { repos: { getCommit, getReleaseByTag } };
    await notifyDeploymentError(
      github as any,
      {
        message: 'my fake error',
        stderr: 'stderr output',
        stdout: 'stdeout output',
        status: 1,
      },
      'staging',
      'myapp',
      {
        token: 'fakeToken',
        channel: 'fakeChannel',
      },
    );
    expect(postMessage.mock.calls[0]).toMatchSnapshot();
  });
});
