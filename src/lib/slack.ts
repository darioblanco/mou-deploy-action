import * as core from '@actions/core';
import { context, GitHub } from '@actions/github';
import { oneLine } from 'common-tags';
import { WebClient, KnownBlock, Block } from '@slack/web-api';

export interface SlackConfig {
  token: string;
  channel: string;
}

async function buildDeploymentMessage(
  client: GitHub,
  actionMessage: string,
  app: string,
  environment: string,
) {
  const { owner, repo } = context.repo;
  const environmentEmoji = environment === 'production' ? ':rocket:' : ':shipit:';

  core.debug(`deployment payload: ${JSON.stringify(context.payload.deployment)}`);
  core.debug(`repository payload: ${JSON.stringify(context.payload.repository)}`);
  const { sha, ref, id: deploymentId } = context.payload.deployment;
  let repoUrl;
  if (context.payload.repository) {
    repoUrl = context.payload.repository.html_url;
  } else {
    repoUrl = `https://github.com/${owner}/${repo}`;
  }

  const commitResponse = await client.repos.getCommit({
    owner,
    repo,
    ref,
  });
  core.debug(`commit response: ${JSON.stringify(commitResponse)}`);
  const {
    author: { login: authorLogin, avatar_url: avatarUrl, html_url: authorUrl },
    commit: {
      message: commitMessage,
      author: { name: authorName },
    },
    html_url: commitUrl,
  } = commitResponse.data;

  let refUrl, deploymentDescription;
  try {
    const releaseResponse = await client.repos.getReleaseByTag({
      owner,
      repo,
      tag: ref,
    });
    // Release has been found
    core.debug(`release response: ${JSON.stringify(releaseResponse)}`);
    const { html_url: releaseUrl, body } = releaseResponse.data;
    refUrl = releaseUrl;
    deploymentDescription = body;
  } catch (error) {
    core.warning(`Unable to retrieve release for tag "${ref}": ${error}`);
    refUrl = `${repoUrl}/commits/${ref}`;
    deploymentDescription = `\`\`\`\n${commitMessage}\n\`\`\``;
  }

  let humanizedRef = ref;
  if (ref === sha) {
    // Ref is the commit sha
    humanizedRef = `${ref.substring(0, 7)}...`;
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: oneLine`
          ${actionMessage}
          *<${repoUrl}/commit/${sha}/checks|${app}>* (<${refUrl}|${humanizedRef}>) to
          *<${repoUrl}/deployments?environment=${environment}#activity-log|${environment}>*
          ${environmentEmoji}
        `,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: deploymentDescription,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `:books: *Repository:* <${repoUrl}|${repo}>`,
        },
        {
          type: 'mrkdwn',
          text: `:person_in_steamy_room: *Author:* ${authorName} <${authorUrl}|@${authorLogin}>`,
        },
        {
          type: 'mrkdwn',
          text: `:beer: *Commit:* <${commitUrl}|${sha.substring(0, 7)}>`,
        },
        {
          type: 'mrkdwn',
          text: `:point_left: *Deployment ID:* ${deploymentId}`,
        },
      ],
      accessory: {
        type: 'image',
        image_url: avatarUrl,
        alt_text: 'avatar_url',
      },
    },
  ];
}

export async function postSlackMessage(
  { token, channel }: SlackConfig,
  blocks: (KnownBlock | Block)[],
  text: string,
) {
  const slackClient = new WebClient(token);
  const result = await slackClient.chat.postMessage({
    channel,
    token,
    blocks,
    text,
  });
  core.debug(`Slack response: ${JSON.stringify(result.response_metadata)}`);
}

export async function notifyDeploymentSuccess(
  client: GitHub,
  environment: string,
  app: string,
  appUrl: string,
  slack: SlackConfig,
) {
  core.info(`Send slack deployment success notification`);
  const blocks = [
    ...(await buildDeploymentMessage(client, 'I have deployed', app, environment)),
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Application url:* <${appUrl}|${appUrl.split('//')[1]}>`,
        },
      ],
    },
    { type: 'divider' },
  ];
  await postSlackMessage(slack, blocks, `Deployed ${app} to ${environment}`);
}

export async function notifyDeploymentError(
  client: GitHub,
  { message, stderr, stdout, status }: {
    message: string, stderr?: string, stdout?: string, status?: number,
  },
  environment: string,
  app: string,
  slack: SlackConfig,
) {
  core.info(`Send slack deployment error notification`);
  const blocks = [
    ...(await buildDeploymentMessage(client, 'I have FAILED to deploy', app, environment)),
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: oneLine`
        ${message} (error code ${status})

        \`stderr\`: \`\`\`${stderr}\`\`\`

        \`stdout\`: \`\`\`${stdout}\`\`\`
        `,
      },
    },
    { type: 'divider' },
  ];
  await postSlackMessage(slack, blocks, `Error deploying ${app} to ${environment}`);
};
