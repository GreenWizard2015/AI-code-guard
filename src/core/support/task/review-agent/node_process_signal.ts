import type { ProcessSignalContract } from "src/protocols";

/** Responsibilities: _process liveness_, _agent process-group termination_. **/
export class NodeProcessSignal implements ProcessSignalContract {
	/** Responsibilities: _process liveness probe_. **/
	public pid_exists(pid: number): boolean {
		try {
			return process.kill(pid, 0);
		} catch (error) {
			const code = Object.getOwnPropertyDescriptor(Object(error), "code")?.value;
			if (code === "EPERM") {
				return true;
			}
			if (code === "ESRCH") {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _process-group liveness probe_. **/
	public group_exists(pid: number): boolean {
		try {
			return process.kill(-pid, 0);
		} catch (error) {
			const code = Object.getOwnPropertyDescriptor(Object(error), "code")?.value;
			if (code === "EPERM") {
				return true;
			}
			if (code === "ESRCH") {
				return false;
			}
			throw error;
		}
	}

	/** Responsibilities: _agent process-group termination_. **/
	public terminate_group(pid: number): void {
		try {
			process.kill(-pid, "SIGTERM");
			process.kill(-pid, "SIGKILL");
		} catch (error) {
			const code = Object.getOwnPropertyDescriptor(Object(error), "code")?.value;
			if (code === "ESRCH" || code === "EPERM") {
				return;
			}
			throw error;
		}
	}
}
