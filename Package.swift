// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PortWatch",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(
            name: "PortWatch",
            targets: ["PortWatch"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.2"),
    ],
    targets: [
        .executableTarget(
            name: "PortWatch",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/PortWatch"
        ),
    ]
)
