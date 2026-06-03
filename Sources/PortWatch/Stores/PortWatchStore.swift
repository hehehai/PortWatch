import Combine
import Foundation

@MainActor
final class PortWatchStore: ObservableObject {
    enum RefreshReason {
        case initial
        case automatic
        case manual
        case postKill
    }

    @Published private(set) var records: [PortRecord] = []
    @Published var selection: PortRecord.ID?
    @Published var searchQuery = ""
    @Published private(set) var isLoading = true
    @Published private(set) var isRefreshing = false
    @Published private(set) var isKilling = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var statusMessage: String?
    @Published private(set) var lastUpdatedAt: Date?
    @Published var pendingTerminationRecord: PortRecord?

    private let inspector: PortInspector
    private let processManager: ProcessManager
    private let settingsStore: PortWatchSettingsStore
    private var refreshLoopTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()
    private let currentUser = NSUserName()

    init(
        settingsStore: PortWatchSettingsStore,
        inspector: PortInspector = PortInspector(),
        processManager: ProcessManager = ProcessManager()
    ) {
        self.settingsStore = settingsStore
        self.inspector = inspector
        self.processManager = processManager

        settingsStore.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else {
                    return
                }
                self.reconcileSelection()
                self.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    deinit {
        refreshLoopTask?.cancel()
    }

    var filteredRecords: [PortRecord] {
        records.filter { record in
            settingsStore.monitors(port: record.port) && record.matches(searchQuery)
        }
    }

    var selectedRecord: PortRecord? {
        if let selection {
            return filteredRecords.first(where: { $0.id == selection })
                ?? records.first(where: { $0.id == selection })
        }
        return filteredRecords.first
    }

    var selectedRefreshProfile: RefreshProfile {
        settingsStore.preferences.selectedRefreshProfile
    }

    var totalPortCount: Int {
        records.count
    }

    var totalProcessCount: Int {
        uniqueProcessCount(in: records)
    }

    var currentUserProcessCount: Int {
        uniqueProcessCount(in: records.filter { $0.user == currentUser })
    }

    var visiblePortCount: Int {
        filteredRecords.count
    }

    var visibleProcessCount: Int {
        uniqueProcessCount(in: filteredRecords)
    }

    func selectRefreshProfile(_ profile: RefreshProfile) {
        settingsStore.selectRefreshProfile(profile)
    }

    func start() {
        guard refreshLoopTask == nil else {
            return
        }

        refreshLoopTask = Task { [weak self] in
            guard let self else {
                return
            }

            await self.refresh(reason: .initial)
            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: self.settingsStore.refreshInterval(for: self.selectedRefreshProfile))
                } catch {
                    break
                }

                if Task.isCancelled {
                    break
                }
                await self.refresh(reason: .automatic)
            }
        }
    }

    func refresh(reason: RefreshReason) async {
        guard !isRefreshing else {
            return
        }

        isRefreshing = true
        if reason == .initial {
            isLoading = true
        }

        do {
            let snapshot = try await Task.detached(priority: .userInitiated) { [inspector] in
                try inspector.fetchListeningPorts()
            }.value

            records = snapshot
            lastUpdatedAt = Date()
            errorMessage = nil
            if reason == .manual {
                statusMessage = "Refreshed \(snapshot.count) listening ports."
            } else if reason == .postKill {
                statusMessage = "Port list updated after termination."
            }
            reconcileSelection()
        } catch {
            errorMessage = error.localizedDescription
            if reason == .manual {
                statusMessage = "Refresh failed."
            }
        }

        isRefreshing = false
        isLoading = false
    }

    func requestTerminationForSelectedProcess() {
        guard let record = selectedRecord, !isKilling else {
            return
        }

        pendingTerminationRecord = record
    }

    func requestTermination(for record: PortRecord) {
        guard !isKilling else {
            return
        }

        pendingTerminationRecord = record
    }

    func dismissTerminationRequest() {
        pendingTerminationRecord = nil
    }

    func confirmTermination() async {
        guard let record = pendingTerminationRecord, !isKilling else {
            return
        }

        pendingTerminationRecord = nil

        isKilling = true
        errorMessage = nil
        statusMessage = "Terminating PID \(record.pid) on port \(record.port)..."

        do {
            try await processManager.terminateProcess(pid: record.pid)
            statusMessage = "Terminated PID \(record.pid) on port \(record.port)."
            await refresh(reason: .postKill)
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Failed to terminate PID \(record.pid)."
        }

        isKilling = false
    }

    private func reconcileSelection() {
        let available = Set(filteredRecords.map(\.id))
        if let selection, available.contains(selection) {
            return
        }

        if let selectedRecord {
            selection = selectedRecord.id
        } else {
            selection = filteredRecords.first?.id
        }
    }

    private func uniqueProcessCount(in records: [PortRecord]) -> Int {
        Set(records.map(\.pid)).count
    }
}
