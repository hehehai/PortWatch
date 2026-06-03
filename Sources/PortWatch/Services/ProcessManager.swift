import Darwin
import Foundation

enum ProcessManagerError: LocalizedError {
    case signalFailed(String)

    var errorDescription: String? {
        switch self {
        case let .signalFailed(message):
            return message
        }
    }
}

struct ProcessManager: Sendable {
    func terminateProcess(pid: Int) async throws {
        let target = pid_t(pid)

        guard Darwin.kill(target, SIGTERM) == 0 else {
            throw ProcessManagerError.signalFailed(
                "Failed to send SIGTERM to PID \(pid): \(String(cString: strerror(errno)))"
            )
        }

        try? await Task.sleep(for: .milliseconds(600))

        guard processExists(pid: target) else {
            return
        }

        guard Darwin.kill(target, SIGKILL) == 0 else {
            throw ProcessManagerError.signalFailed(
                "Failed to send SIGKILL to PID \(pid): \(String(cString: strerror(errno)))"
            )
        }
    }

    private func processExists(pid: pid_t) -> Bool {
        if Darwin.kill(pid, 0) == 0 {
            return true
        }
        return errno == EPERM
    }
}
