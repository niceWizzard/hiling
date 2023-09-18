import { Args, Command, Flags, ux } from "@oclif/core";
import axios from "axios";
import chalk from "chalk";
import { URL } from "url";
import axiosRetry from "axios-retry";
import * as fs from "fs";
import * as path from "path";

export default class Start extends Command {
  static description = "Starts the automatic requests.";

  static examples = ["<%= config.bin %> <%= command.id %>"];

  static flags = {
    timeout: Flags.integer({
      default: 250,
      description: "The timeout between requests",
    }),
    method: Flags.string({
      default: "GET",
      description: "The HTTP method to use",
      aliases: ["m"],
    }),
  };

  static args = {
    url: Args.url({ description: "url to request" }),
  };

  private async validateConfig() {
    const { args, flags } = await this.parse(Start);

    const filePath = path.join(path.resolve("./"), "hiling.config.json");
    let userConfig: any;
    if (fs.existsSync(filePath)) {
      this.log(chalk.gray("Found hiling.config.json."));
      try {
        userConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
        this.log(chalk.gray("Loaded hiling.config.json"));
      } catch (error) {
        this.log(error as any);
      }
    }

    flags.method ??= userConfig?.method;
    flags.timeout ??= userConfig?.timeout;
    args.url ??= userConfig?.url;

    let method = flags.method || userConfig?.method;

    const allowedMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    if (!allowedMethods.includes(method)) {
      throw new Error(
        `Invalid method ${method}. Allowed methods are ${allowedMethods.join(
          ", "
        )}`
      );
    }
    let url = args.url;

    if (!url) {
      do {
        try {
          let n = await ux.prompt(`${chalk.green("What is the url?: ")}`, {
            required: true,
          });
          args.url = new URL(n);
        } catch {
          this.log(chalk.red("Invalid URL."));
          continue;
        }
      } while (args.url == undefined);
    }

    return {
      args,
      flags,
      userConfig,
    };
  }

  public async run(): Promise<void> {
    axiosRetry(axios, { retries: 3 });

    const { args, flags } = await this.validateConfig();

    let { method, timeout } = flags;
    let { url } = args;

    ux.action.start(
      `${chalk.blue(`[${method.toUpperCase()}]`)} to ${chalk.blue(url)}`
    );
    let totalRequest = 0;
    let success = 0;
    let failed = 0;
    setInterval(async () => {
      ux.action.status = `${chalk.green(`${success} success`)}. ${chalk.red(
        `${failed} fails.`
      )} / ${chalk.cyan(`${totalRequest} total`)} `;
      totalRequest += 1;
      try {
        await axios.request({
          url: url?.toString()!,
          method,
        });
        success += 1;
      } catch (error) {
        const err = error as Error;
        if (failed % 50 == 0) {
          this.log(
            `${chalk.red(`Failed to request ${url}`)} because of ${err.message}`
          );
        }
        failed += 1;
      }
    }, timeout);
  }
}
