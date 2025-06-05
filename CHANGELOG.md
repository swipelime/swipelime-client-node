# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5] - 2025-06-05
### Added
* Added fees to TaskOrderPaymentDetailsDataBase type

## [0.4.4] - 2025-06-04
### Added
* Added missing isPaid parameter to TaskOrderPaymentDetailsDataBase type

## [0.4.3] - 2025-06-04
### Added
* PaymentEventData type changes
* New ElementIdExtendedData for extended data like price
### Fixed
* Fixed long running tasks not triggered when client is not connected

## [0.4.2] - 2024-12-04
### Fixed
* Quick type and comment fixes

## [0.4.1] - 2024-11-26
### Fixed
* Fixed processing new incoming tasks
* Various error handling fixes

## [0.4.0] - 2024-11-25
### Fixed
* Various type issues
* Errors from methods are going to the console only and don't need try/catch anymore
* Updated various packages

## [0.3.1] - 2024-11-20
### Added
* Payment related new methods: markOrderItemsPaymentStatus and cancelPayment
* A ping method to check the server/connection status
* Various type changes

## [0.3.0] - 2024-10-17
### Added
* Various type changes
* A deferred queuing system to process new tasks
* Check for long running tasks and automatically defer them

## [0.2.11] - 2024-09-09
### Fixed
* Fixed changeOrderItemsStatus method checks

## [0.2.10] - 2024-09-05
### Added
* Various type changes
* Added changeOrderItemsStatus method for confirming or cancelling order items
### Fixed
* Fixed addCustomOrderItems method to support adding multiple order items

## [0.2.9] - 2024-07-25
### Added
* Added new swipelime task: confirm-universal-menu-elements.

## [0.2.8] - 2024-07-15
### Fixed
* Added new swipelime event: order-items-moved

## [0.2.7] - 2024-06-19
### Fixed
* Client version string update

## [0.2.6] - 2024-06-17
### Fixed
* Increased event emitter max listeners to 100

## [0.2.5] - 2024-06-13
### Added
* Added new swipelime event: order-items-changed.

## [0.2.4] - 2024-05-21
### Added
* Added new swipelime events: tables-added, tables-updated, tables-removed.
* Added new service handler methods: upsertTables, deleteTables.
* Added version check to prevent using old clients.
### Fixed
* Fixed upsertUniversalMenuItems method's return type

## [0.2.3] - 2024-05-15
### Fixed
* Fix getUniversalMenuItems and getUniversalMenuCategories methods to get the correct menu elements

## [0.2.2] - 2024-05-13
### Fixed
* Corrected getOrderItems method name

## [0.2.1] - 2024-05-12
### Added
* Added new service handler method: addCustomOrderItem.
### Fixed
* Fixed various method type issues

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
