// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GridSail {
    uint8 public constant GRID_SIZE = 9;
    uint8 public constant DAILY_LIMIT = 5;

    struct Voyage {
        uint8 shipX;
        uint8 shipY;
        uint8 beaconX;
        uint8 beaconY;
        uint16 docks;
        uint64 moves;
        bool initialized;
    }

    struct Profile {
        uint64 totalMoves;
        uint32 totalDocks;
        uint64 lastActiveDay;
        uint8 todayMoves;
        uint8 lastDirection;
        uint64 lastSailedAt;
    }

    mapping(uint64 => Voyage) private voyages;
    mapping(address => Profile) private profiles;
    uint64 public globalMoves;
    uint64 public globalDocks;

    error InvalidDirection();
    error DailyLimitReached();

    event CourseChanged(
        address indexed sailor,
        uint64 indexed day,
        uint8 indexed direction,
        uint8 shipX,
        uint8 shipY,
        bool docked
    );

    function sail(uint8 direction) external {
        if (direction > 3) revert InvalidDirection();

        uint64 day = uint64(block.timestamp / 1 days);
        Profile storage profile = profiles[msg.sender];
        if (profile.lastActiveDay != day) {
            profile.lastActiveDay = day;
            profile.todayMoves = 0;
        }
        if (profile.todayMoves >= DAILY_LIMIT) revert DailyLimitReached();

        Voyage storage voyage = voyages[day];
        if (!voyage.initialized) _initialize(voyage, day);

        if (direction == 0) {
            voyage.shipY = uint8((voyage.shipY + GRID_SIZE - 1) % GRID_SIZE);
        } else if (direction == 1) {
            voyage.shipX = uint8((voyage.shipX + 1) % GRID_SIZE);
        } else if (direction == 2) {
            voyage.shipY = uint8((voyage.shipY + 1) % GRID_SIZE);
        } else {
            voyage.shipX = uint8((voyage.shipX + GRID_SIZE - 1) % GRID_SIZE);
        }

        profile.totalMoves += 1;
        profile.todayMoves += 1;
        profile.lastDirection = direction;
        profile.lastSailedAt = uint64(block.timestamp);
        voyage.moves += 1;
        globalMoves += 1;

        bool docked = voyage.shipX == voyage.beaconX &&
            voyage.shipY == voyage.beaconY;
        if (docked) {
            voyage.docks += 1;
            profile.totalDocks += 1;
            globalDocks += 1;
            _nextBeacon(voyage, day);
        }

        emit CourseChanged(
            msg.sender,
            day,
            direction,
            voyage.shipX,
            voyage.shipY,
            docked
        );
    }

    function voyageOf(
        uint64 day
    )
        external
        view
        returns (
            uint8 shipX,
            uint8 shipY,
            uint8 beaconX,
            uint8 beaconY,
            uint16 docks,
            uint64 moves
        )
    {
        Voyage storage voyage = voyages[day];
        if (voyage.initialized) {
            return (
                voyage.shipX,
                voyage.shipY,
                voyage.beaconX,
                voyage.beaconY,
                voyage.docks,
                voyage.moves
            );
        }
        (shipX, shipY, beaconX, beaconY) = _initialCoordinates(day);
    }

    function statsOf(address user) external view returns (Profile memory stats) {
        stats = profiles[user];
        uint64 currentDay = uint64(block.timestamp / 1 days);
        if (stats.lastActiveDay != currentDay) stats.todayMoves = 0;
    }

    function _initialize(Voyage storage voyage, uint64 day) private {
        (
            voyage.shipX,
            voyage.shipY,
            voyage.beaconX,
            voyage.beaconY
        ) = _initialCoordinates(day);
        voyage.initialized = true;
    }

    function _initialCoordinates(
        uint64 day
    ) private pure returns (uint8 shipX, uint8 shipY, uint8 beaconX, uint8 beaconY) {
        uint256 seed = uint256(keccak256(abi.encodePacked("GRIDSAIL", day)));
        shipX = uint8(seed % GRID_SIZE);
        shipY = uint8((seed >> 16) % GRID_SIZE);
        beaconX = uint8((seed >> 32) % GRID_SIZE);
        beaconY = uint8((seed >> 48) % GRID_SIZE);
        if (shipX == beaconX && shipY == beaconY) {
            beaconX = uint8((beaconX + 4) % GRID_SIZE);
        }
    }

    function _nextBeacon(Voyage storage voyage, uint64 day) private {
        uint256 seed = uint256(
            keccak256(abi.encodePacked("NEXT_PORT", day, voyage.docks, voyage.moves))
        );
        voyage.beaconX = uint8(seed % GRID_SIZE);
        voyage.beaconY = uint8((seed >> 16) % GRID_SIZE);
        if (voyage.shipX == voyage.beaconX && voyage.shipY == voyage.beaconY) {
            voyage.beaconY = uint8((voyage.beaconY + 5) % GRID_SIZE);
        }
    }
}
