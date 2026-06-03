import Foundation

struct ShellCommandResult: Sendable {
    let stdout: String
    let stderr: String
    let exitCode: Int32
}

enum ShellCommandError: LocalizedError {
    case failedToLaunch(String)

    var errorDescription: String? {
        switch self {
        case let .failedToLaunch(message):
            return message
        }
    }
}

struct ShellCommandRunner: Sendable {
    func run(_ executable: String, arguments: [String]) throws -> ShellCommandResult {
        let process = Process()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        let group = DispatchGroup()
        let stdoutDataBox = LockedDataBox()
        let stderrDataBox = LockedDataBox()

        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        do {
            try process.run()
        } catch {
            throw ShellCommandError.failedToLaunch(
                "Failed to launch \(executable): \(error.localizedDescription)"
            )
        }

        group.enter()
        DispatchQueue.global(qos: .userInitiated).async {
            stdoutDataBox.data = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }

        group.enter()
        DispatchQueue.global(qos: .userInitiated).async {
            stderrDataBox.data = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }

        process.waitUntilExit()
        group.wait()

        let stdoutData = stdoutDataBox.data
        let stderrData = stderrDataBox.data

        return ShellCommandResult(
            stdout: String(decoding: stdoutData, as: UTF8.self),
            stderr: String(decoding: stderrData, as: UTF8.self),
            exitCode: process.terminationStatus
        )
    }
}

private final class LockedDataBox: @unchecked Sendable {
    private let lock = NSLock()
    private var value = Data()

    var data: Data {
        get {
            lock.lock()
            defer { lock.unlock() }
            return value
        }
        set {
            lock.lock()
            value = newValue
            lock.unlock()
        }
    }
}
