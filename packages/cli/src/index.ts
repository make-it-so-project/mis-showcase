#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { ApprovalRequest } from '@make-it-so/shared';
import { ApiClient } from './client.js';

const client = new ApiClient(process.env.APPROVAL_CORE_URL ?? 'http://localhost:4000');

const program = new Command();

program
  .name('make-it-so')
  .description('CLI for the Make It So approval platform')
  .version('0.1.0');

/**
 * Formats a request for terminal output
 */
function formatRequest(request: ApprovalRequest): string {
  const lines: string[] = [];
  const statusColors: Record<string, (s: string) => string> = {
    PENDING: chalk.yellow,
    APPROVED: chalk.green,
    DENIED: chalk.red,
    EXPIRED: chalk.gray,
    CANCELLED: chalk.gray,
  };

  const colorFn = statusColors[request.status] ?? chalk.white;

  lines.push(chalk.bold(`  ID:          `) + chalk.cyan(request.id));
  lines.push(chalk.bold(`  Type:        `) + request.action_type);
  lines.push(chalk.bold(`  Description: `) + request.description);
  lines.push(chalk.bold(`  Status:      `) + colorFn(request.status));
  lines.push(chalk.bold(`  Created:     `) + new Date(request.created_at).toLocaleString());
  lines.push(chalk.bold(`  Expires:     `) + new Date(request.expires_at).toLocaleString());

  if (request.requires_2fa) {
    lines.push(chalk.bold(`  2FA:         `) + chalk.yellow('Required'));
  }

  if (request.metadata) {
    if (request.metadata.amount !== undefined) {
      lines.push(chalk.bold(`  Amount:      `) + `${request.metadata.amount} ${request.metadata.currency ?? 'EUR'}`);
    }
    if (request.metadata.recipient) {
      lines.push(chalk.bold(`  Recipient:   `) + String(request.metadata.recipient));
    }
  }

  return lines.join('\n');
}

/**
 * list — Show all pending requests
 */
program
  .command('list')
  .description('List all pending approval requests')
  .requiredOption('-u, --user <user_ref>', 'User reference')
  .action(async (options: { user: string }) => {
    const spinner = ora('Loading requests...').start();

    try {
      const requests = await client.listPending(options.user);
      spinner.stop();

      if (requests.length === 0) {
        console.log(chalk.green('\n✓ No pending approvals\n'));
        return;
      }

      console.log(chalk.bold(`\n${requests.length} pending request(s):\n`));

      for (const request of requests) {
        console.log(chalk.dim('─'.repeat(60)));
        console.log(formatRequest(request));
      }
      console.log(chalk.dim('─'.repeat(60)));
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * show — Show details of a single request
 */
program
  .command('show <request_id>')
  .description('Show details of an approval request')
  .action(async (requestId: string) => {
    const spinner = ora('Loading request...').start();

    try {
      const response = await client.getRequest(requestId);
      spinner.stop();

      console.log(chalk.bold('\nRequest details:\n'));
      console.log(formatRequest(response.request));

      if (response.approval_token) {
        console.log(chalk.bold(`  Token:       `) + chalk.green(response.approval_token));
      }

      if (response.action_credential) {
        console.log();
        console.log(chalk.bgGreen.black(' 2FA CODE '));
        console.log(chalk.bold.green(`\n  ${response.action_credential.value}\n`));
        console.log(chalk.dim(`  Valid until: ${new Date(response.action_credential.expires_at).toLocaleString()}`));
      }

      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * approve — Approve a request
 */
program
  .command('approve <request_id>')
  .alias('makeitso')
  .description('Make it so! — Approve an approval request')
  .action(async (requestId: string) => {
    const spinner = ora('Make it so...').start();

    try {
      const response = await client.approve(requestId);
      spinner.succeed(chalk.yellow.bold('✨ Make it so! ✨'));

      console.log(chalk.bold('\nDetails:\n'));
      console.log(formatRequest(response.request));

      if (response.approval_token) {
        console.log(chalk.bold(`  Token:       `) + chalk.green(response.approval_token));
      }

      if (response.action_credential) {
        console.log();
        console.log(chalk.bgGreen.black.bold(' 2FA CODE '));
        console.log(chalk.bold.green(`\n  >>> ${response.action_credential.value} <<<\n`));
        console.log(chalk.dim(`  Valid until: ${new Date(response.action_credential.expires_at).toLocaleString()}`));
        console.log(chalk.dim('  This code can only be used once.'));
      }

      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * deny — Deny a request
 */
program
  .command('deny <request_id>')
  .description('Deny an approval request')
  .action(async (requestId: string) => {
    const spinner = ora('Denying request...').start();

    try {
      await client.deny(requestId);
      spinner.succeed(chalk.red('Request denied.'));
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * watch — Poll for new requests
 */
program
  .command('watch')
  .description('Watch for new approval requests (polling)')
  .requiredOption('-u, --user <user_ref>', 'User reference')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '5')
  .action(async (options: { user: string; interval: string }) => {
    const intervalMs = parseInt(options.interval, 10) * 1000;
    let knownIds = new Set<string>();

    console.log(chalk.cyan(`\n◈ Watching requests for ${chalk.bold(options.user)}...`));
    console.log(chalk.dim(`  Polling interval: ${options.interval}s`));
    console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

    const check = async () => {
      try {
        const requests = await client.listPending(options.user);

        for (const request of requests) {
          if (!knownIds.has(request.id)) {
            knownIds.add(request.id);
            console.log(chalk.yellow(`\n🔔 New request!\n`));
            console.log(formatRequest(request));
            console.log();
            console.log(chalk.yellow(`  Approve:  make-it-so approve ${request.id}`));
            console.log(chalk.dim(`  Deny:     make-it-so deny ${request.id}`));
            console.log();
          }
        }

        // Remove completed requests from known IDs
        const currentIds = new Set(requests.map((r) => r.id));
        knownIds = new Set([...knownIds].filter((id) => currentIds.has(id)));
      } catch (err) {
        console.error(chalk.red(`Fetch error: ${err instanceof Error ? err.message : 'Unknown'}`));
      }
    };

    // Initial check
    await check();

    // Regular polling
    setInterval(check, intervalMs);
  });

program.parse();
