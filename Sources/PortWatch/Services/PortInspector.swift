import Foundation

struct PortInspector: Sendable {
    private let runner: ShellCommandRunner

    init(runner: ShellCommandRunner = ShellCommandRunner()) {
        self.runner = runner
    }

    func fetchListeningPorts() throws -> [PortRecord] {
        let lsofResult = try runner.run(
            "/usr/sbin/lsof",
            arguments: ["-iTCP", "-sTCP:LISTEN", "-P", "-n"]
        )

        if lsofResult.exitCode != 0 && lsofResult.stdout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return []
        }

        let baseRecords = parseListeningPorts(from: lsofResult.stdout)
        if baseRecords.isEmpty {
            return []
        }

        let pids = Array(Set(baseRecords.map(\.pid))).sorted()
        let metadata = try fetchProcessMetadata(pids: pids)
        let launchMetadata = try fetchLaunchMetadata(pids: pids)

        return dedupeAndSort(
            baseRecords.map { record in
                let processMetadata = metadata[record.pid]
                let launch = launchMetadata[record.pid]
                let mergedMetadata = merged(record: record, metadata: processMetadata, launch: launch)
                return mergedMetadata
            }
        )
    }

    private func fetchProcessMetadata(pids: [Int]) throws -> [Int: ProcessMetadata] {
        guard !pids.isEmpty else {
            return [:]
        }

        let lsofResult = try runner.run(
            "/usr/sbin/lsof",
            arguments: ["-a", "-d", "cwd,txt", "-Ffnp", "-p", pidList(pids)]
        )
        let psResult = try runner.run(
            "/bin/ps",
            arguments: ["-ww", "-p", pidList(pids), "-o", "pid=", "-o", "lstart=", "-o", "command="]
        )

        var metadata = lsofResult.exitCode == 0 ? parseProcessMetadata(from: lsofResult.stdout) : [:]
        if psResult.exitCode == 0 {
            let psMetadata = parseProcessTimestamps(from: psResult.stdout)
            for (pid, item) in psMetadata {
                var current = metadata[pid] ?? ProcessMetadata()
                current.startedAt = item.startedAt
                current.title = item.title
                current.uptime = item.uptime
                metadata[pid] = current
            }
        }
        return metadata
    }

    private func fetchLaunchMetadata(pids: [Int]) throws -> [Int: LaunchMetadata] {
        guard !pids.isEmpty else {
            return [:]
        }

        let psResult = try runner.run(
            "/bin/ps",
            arguments: ["-axo", "pid=", "-o", "ppid=", "-o", "tty=", "-o", "command="]
        )

        guard psResult.exitCode == 0 else {
            return [:]
        }

        let table = parseProcessTable(from: psResult.stdout)
        var result: [Int: LaunchMetadata] = [:]
        for pid in pids {
            let metadata = inferLaunchMetadata(pid: pid, table: table)
            if metadata.launchedBy != nil || !metadata.launchChain.isEmpty {
                result[pid] = metadata
            }
        }
        return result
    }

    private func merged(
        record: PortRecord,
        metadata: ProcessMetadata?,
        launch: LaunchMetadata?
    ) -> PortRecord {
        let source = resolveSource(for: record, metadata: metadata)
        return PortRecord(
            pid: record.pid,
            command: record.command,
            user: record.user,
            fd: record.fd,
            type: record.type,
            device: record.device,
            sizeOff: record.sizeOff,
            node: record.node,
            endpoint: record.endpoint,
            port: record.port,
            protocolName: record.protocolName,
            state: record.state,
            workingDirectory: metadata?.cwd,
            executablePath: metadata?.executablePath,
            source: source,
            startedAt: metadata?.startedAt,
            uptime: metadata?.uptime,
            launchedBy: launch?.launchedBy,
            launchChain: launch?.launchChain ?? []
        )
    }

    private func resolveSource(for record: PortRecord, metadata: ProcessMetadata?) -> String? {
        guard let metadata else {
            return nil
        }

        if let cwd = metadata.cwd, cwd != "/" {
            return cwd
        }

        if let appName = appName(from: metadata.executablePath ?? metadata.title) {
            return appName
        }

        if let title = metadata.title, title != record.command {
            if title.contains("/") {
                return appName(from: title) ?? basename(of: title)
            }
            return title
        }

        if let executablePath = metadata.executablePath {
            return basename(of: executablePath)
        }

        return metadata.cwd
    }

    private func parseListeningPorts(from output: String) -> [PortRecord] {
        let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
        guard lines.count > 1 else {
            return []
        }

        var records: [PortRecord] = []
        for line in lines.dropFirst() {
            let parts = line.split(
                maxSplits: 8,
                omittingEmptySubsequences: true,
                whereSeparator: \.isWhitespace
            )
            guard parts.count >= 9 else {
                continue
            }

            let command = String(parts[0])
            let pid = Int(parts[1]) ?? -1
            let user = String(parts[2])
            let fd = String(parts[3])
            let type = String(parts[4])
            let device = String(parts[5])
            let sizeOff = String(parts[6])
            let node = String(parts[7])
            let endpoint = String(parts[8])
            let port = parsePort(from: endpoint)

            guard pid > 0, port > 0 else {
                continue
            }

            records.append(
                PortRecord(
                    pid: pid,
                    command: command,
                    user: user,
                    fd: fd,
                    type: type,
                    device: device,
                    sizeOff: sizeOff,
                    node: node,
                    endpoint: endpoint,
                    port: port,
                    protocolName: "TCP",
                    state: "LISTEN",
                    workingDirectory: nil,
                    executablePath: nil,
                    source: nil,
                    startedAt: nil,
                    uptime: nil,
                    launchedBy: nil,
                    launchChain: []
                )
            )
        }

        return records
    }

    private func parsePort(from endpoint: String) -> Int {
        let pattern = /:(\d+)(?:\s+\(LISTEN\))?$/
        guard let match = endpoint.firstMatch(of: pattern) else {
            return 0
        }
        return Int(match.1) ?? 0
    }

    private func parseProcessMetadata(from output: String) -> [Int: ProcessMetadata] {
        var metadata: [Int: ProcessMetadata] = [:]
        var currentPID: Int?
        var currentFD: String?

        for rawLine in output.split(separator: "\n", omittingEmptySubsequences: true) {
            let line = String(rawLine)
            guard let field = line.first else {
                continue
            }
            let value = String(line.dropFirst())

            switch field {
            case "p":
                currentPID = Int(value)
                currentFD = nil
                if let currentPID, metadata[currentPID] == nil {
                    metadata[currentPID] = ProcessMetadata()
                }
            case "f":
                currentFD = value
            case "n":
                guard let currentPID, let currentFD else {
                    continue
                }
                var item = metadata[currentPID] ?? ProcessMetadata()
                if currentFD == "cwd" {
                    item.cwd = value
                } else if currentFD == "txt", item.executablePath == nil {
                    item.executablePath = value
                }
                metadata[currentPID] = item
            default:
                continue
            }
        }

        return metadata
    }

    private func parseProcessTimestamps(from output: String) -> [Int: ProcessMetadata] {
        var metadata: [Int: ProcessMetadata] = [:]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "EEE MMM d HH:mm:ss yyyy"

        for rawLine in output.split(separator: "\n", omittingEmptySubsequences: true) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            let parts = line.split(whereSeparator: \.isWhitespace)
            guard parts.count >= 6, let pid = Int(parts[0]) else {
                continue
            }

            let startString = parts[1 ... 5].map(String.init).joined(separator: " ")
            let title = parts.count > 6 ? parts[6...].map(String.init).joined(separator: " ") : nil
            let startedAt = formatter.date(from: startString)
            let uptime = startedAt.map { Date().timeIntervalSince($0) }

            metadata[pid] = ProcessMetadata(
                cwd: nil,
                executablePath: nil,
                title: title,
                startedAt: startedAt,
                uptime: uptime
            )
        }

        return metadata
    }

    private func parseProcessTable(from output: String) -> [Int: ProcessTableEntry] {
        var table: [Int: ProcessTableEntry] = [:]

        for rawLine in output.split(separator: "\n", omittingEmptySubsequences: true) {
            let parts = rawLine.split(
                maxSplits: 3,
                omittingEmptySubsequences: true,
                whereSeparator: \.isWhitespace
            )
            guard parts.count >= 4,
                  let pid = Int(parts[0]),
                  let ppid = Int(parts[1])
            else {
                continue
            }

            table[pid] = ProcessTableEntry(
                pid: pid,
                ppid: ppid,
                tty: String(parts[2]),
                command: String(parts[3])
            )
        }

        return table
    }

    private func inferLaunchMetadata(pid: Int, table: [Int: ProcessTableEntry]) -> LaunchMetadata {
        let chain = processChain(for: pid, table: table)
        let visibleChain = chain.compactMap { entry -> VisibleProcess? in
            let name = processDisplayName(for: entry)
            guard !name.isEmpty, !isSystemLaunchProcess(name) else {
                return nil
            }
            return VisibleProcess(name: name, appName: appName(from: entry.command))
        }

        let launchChain = dedupeAdjacent(visibleChain.map(\.name))
        let launchedBy = visibleChain.first(where: { $0.appName != nil })?.appName ?? launchChain.first

        return LaunchMetadata(launchedBy: launchedBy, launchChain: launchChain)
    }

    private func processChain(for pid: Int, table: [Int: ProcessTableEntry]) -> [ProcessTableEntry] {
        var chain: [ProcessTableEntry] = []
        var seen = Set<Int>()
        var currentPID: Int? = pid

        while let pid = currentPID, !seen.contains(pid), seen.count < 32 {
            seen.insert(pid)
            guard let entry = table[pid] else {
                break
            }
            chain.insert(entry, at: 0)
            if entry.ppid <= 0 {
                break
            }
            currentPID = entry.ppid
        }

        return chain
    }

    private func processDisplayName(for entry: ProcessTableEntry) -> String {
        if let appName = appName(from: entry.command) {
            return appName
        }

        let tokens = entry.command.split(whereSeparator: \.isWhitespace).map(String.init)
        guard let executable = tokens.first else {
            return entry.command
        }

        let baseName = basename(of: executable.trimmingCharacters(in: CharacterSet(charactersIn: "-")))
        if ["node", "bun", "python", "python3"].contains(baseName),
           tokens.count > 1,
           !tokens[1].hasPrefix("-")
        {
            return stripScriptExtension(basename(of: tokens[1]))
        }

        return stripScriptExtension(baseName)
    }

    private func dedupeAndSort(_ records: [PortRecord]) -> [PortRecord] {
        var byID: [String: PortRecord] = [:]
        for record in records {
            byID[record.id] = record
        }

        return byID.values.sorted {
            if $0.port == $1.port {
                if $0.command == $1.command {
                    return $0.pid < $1.pid
                }
                return $0.command.localizedCaseInsensitiveCompare($1.command) == .orderedAscending
            }
            return $0.port < $1.port
        }
    }

    private func pidList(_ pids: [Int]) -> String {
        pids.map(String.init).joined(separator: ",")
    }

    private func basename(of path: String) -> String {
        let normalized = path.replacingOccurrences(of: "\\", with: "/").trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return normalized.split(separator: "/").last.map(String.init) ?? path
    }

    private func stripScriptExtension(_ value: String) -> String {
        value.replacingOccurrences(
            of: #"\.(cjs|js|mjs|ts|tsx)$"#,
            with: "",
            options: .regularExpression
        )
    }

    private func appName(from path: String?) -> String? {
        guard let path else {
            return nil
        }

        let pattern = #"(?:^|/)([^/]+)\.app(?:/|$)"#
        guard let range = path.range(of: pattern, options: .regularExpression) else {
            return nil
        }

        let match = String(path[range])
        return match
            .split(separator: "/")
            .last?
            .replacingOccurrences(of: ".app", with: "")
    }

    private func isSystemLaunchProcess(_ name: String) -> Bool {
        name == "launchd" || name == "login"
    }

    private func dedupeAdjacent(_ values: [String]) -> [String] {
        var deduped: [String] = []
        for value in values where deduped.last != value {
            deduped.append(value)
        }
        return deduped
    }
}

private struct ProcessMetadata: Sendable {
    var cwd: String?
    var executablePath: String?
    var title: String?
    var startedAt: Date?
    var uptime: TimeInterval?
}

private struct ProcessTableEntry: Sendable {
    let pid: Int
    let ppid: Int
    let tty: String
    let command: String
}

private struct LaunchMetadata: Sendable {
    let launchedBy: String?
    let launchChain: [String]
}

private struct VisibleProcess: Sendable {
    let name: String
    let appName: String?
}
