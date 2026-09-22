import { resolve } from 'node:path';
import type { CliOptions } from 'src/bridge/ts/core/types';

/** Responsibilities: _CLI arguments directory parsing_. **/
export class CommandLineOptions {
	private readonly option_prefix = '--';

	/** Responsibilities: _creation default CLI option_. **/
	private default_options(): CliOptions {
		return {
			ignored_directories: [],
			entry_files: [],
			root: process.cwd(),
			timings: false,
			batch_size: 10,
			policy: 'top-category',
		};
	}

	/** Responsibilities: _application directory-related CLI option_. **/
	private apply_directory_option(options: CliOptions, option: string, value: string): boolean {
		if (option === `${this.option_prefix}ignore-dir`) {
			options.ignored_directories.push(value);
			return true;
		}
		if (option === `${this.option_prefix}entry-file`) {
			options.entry_files.push(value.replaceAll('\\', '/'));
			return true;
		}
		if (option === `${this.option_prefix}root`) {
			options.root = resolve(process.cwd(), value);
			return true;
		}
		return false;
	}

	/** Responsibilities: _application task report-related CLI_. **/
	private apply_task_option(options: CliOptions, option: string, value: string): boolean {
		if (option === `${this.option_prefix}batch-size`) {
			const batch_size = Number(value);
			if (!Number.isInteger(batch_size) || batch_size < 1) {
				throw new Error(`Invalid --batch-size value: ${value}`);
			}
			options.batch_size = batch_size;
			return true;
		}
		if (option === `${this.option_prefix}policy`) {
			if (value !== 'top-category' && value !== 'all') {
				throw new Error(`Invalid --policy value: ${value}`);
			}
			options.policy = value;
			return true;
		}
		return false;
	}

	/** Responsibilities: _application CLI option reporting_. **/
	public option_applied(options: CliOptions, option: string, value: string): boolean {
		if (this.apply_directory_option(options, option, value)) {
			return true;
		}
		return this.apply_task_option(options, option, value);
	}

	/** Responsibilities: _raw CLI argument parsing_. **/
	public from_arguments(arguments_list: readonly string[]): CliOptions {
		const options = this.default_options();
		for (let index = 0; index < arguments_list.length; index += 1) {
			const option = arguments_list[index];
			if (option === `${this.option_prefix}timings`) {
				options.timings = true;
				continue;
			}
			if (index === arguments_list.length - 1) {
				continue;
			}
			const value = arguments_list[index + 1];
			if (value !== undefined && this.option_applied(options, option, value)) {
				index += 1;
			}
		}
		return options;
	}
}
