# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-05-11
### Added
* Added new swipelime events: universal-menu-elements-added, universal-menu-elements-updated, universal-menu-elements-removed.
* Added new service handler methods: getOrders, cancelOrderItems, getUniversalMenuElements, getUniversalMenuItems, getUniversalMenuCategories, getTables, getTable, deleteMenuElementsByIds, upsertUniversalMenuItems.

## [0.1.1] - 2024-05-02
### Added
* Added new swipelime events: customer-joined-table, order-items-added, order-items-confirmed, order-items-cancelled, payment-requested, payment-request-cancelled.
* Added new service handler methods: markPaymentDone, markPaymentCancelled, finishTable.
### Fixed
* Unknown events and command will be automatically confirmed/refused and never be emitted.

## [0.1.0] - 2024-04-25
### Added
* Initial version of the swipelime client.
