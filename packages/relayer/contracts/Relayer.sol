// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@mimic-fi/v3-smart-vault/contracts/interfaces/ISmartVault.sol';
import '@mimic-fi/v3-tasks/contracts/interfaces/ITask.sol';

import './interfaces/IRelayer.sol';

/**
 * @title Relayer
 * @dev Relayer used to execute relayed tasks
 */
contract Relayer is IRelayer, Ownable {
    using SafeERC20 for IERC20;

    // Gas amount charged to cover base costs
    uint256 public constant BASE_GAS = 29e3;

    // Variable used to allow a better developer experience to reimburse tx gas cost
    // solhint-disable-next-line var-name-mixedcase
    uint256 private __initialGas__;

    // Default collector address
    address public override defaultCollector;

    // List of allowed executors
    mapping (address => bool) public override isExecutorAllowed;

    // List of native token balances per smart vault
    mapping (address => uint256) public override getSmartVaultBalance;

    // List of custom collector address per smart vault
    mapping (address => address) public override getSmartVaultCollector;

    // List of maximum quota to be used per smart vault
    mapping (address => uint256) public override getSmartVaultMaxQuota;

    // List of used quota per smart vault
    mapping (address => uint256) public override getSmartVaultUsedQuota;

    /**
     * @dev Creates a new Relayer contract
     * @param executor Address of the executor that will be allowed to call the relayer
     * @param collector Address of the default collector to be set
     * @param owner Address that will own the fee collector
     */
    constructor(address executor, address collector, address owner) {
        _setExecutor(executor, true);
        _setDefaultCollector(collector);
        _transferOwnership(owner);
    }

    /**
     * @dev Tells the collector address applicable for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getApplicableCollector(address smartVault) public view override returns (address) {
        address customCollector = getSmartVaultCollector[smartVault];
        return customCollector != address(0) ? customCollector : defaultCollector;
    }

    /**
     * @dev Configures an external executor
     * @param executor Address of the executor to be set
     * @param allowed Whether the given executor should be allowed or not
     */
    function setExecutor(address executor, bool allowed) external override onlyOwner {
        _setExecutor(executor, allowed);
    }

    /**
     * @dev Sets the default collector
     * @param collector Address of the new default collector to be set
     */
    function setDefaultCollector(address collector) external override onlyOwner {
        _setDefaultCollector(collector);
    }

    /**
     * @dev Sets a custom collector for a smart vault
     * @param smartVault Address of smart vault to set a collector for
     * @param collector Address of the collector to be set for the given smart vault
     */
    function setSmartVaultCollector(address smartVault, address collector) external override onlyOwner {
        require(collector != address(0), 'RELAYER_COLLECTOR_ZERO');
        getSmartVaultCollector[smartVault] = collector;
        emit SmartVaultCollectorSet(smartVault, collector);
    }

    /**
     * @dev Sets a maximum quota for a smart vault
     * @param smartVault Address of smart vault to set a maximum quota for
     * @param maxQuota Maximum quota to be set for the given smart vault
     */
    function setSmartVaultMaxQuota(address smartVault, uint256 maxQuota) external override onlyOwner {
        getSmartVaultMaxQuota[smartVault] = maxQuota;
        emit SmartVaultMaxQuotaSet(smartVault, maxQuota);
    }

    /**
     * @dev Deposits native tokens for a given smart vault. First, it will pay part of the quota if any.
     * @param smartVault Address of smart vault to deposit balance for
     * @param amount Amount of native tokens to be deposited, must match msg.value
     */
    function deposit(address smartVault, uint256 amount) external payable override {
        require(msg.value == amount, 'RELAYER_DEPOSIT_INVALID_AMOUNT');
        uint256 amountPaid = _payQuota(smartVault, amount);
        uint256 toDeposit = amount - amountPaid;
        getSmartVaultBalance[smartVault] += toDeposit;
        emit Deposited(smartVault, toDeposit);
    }

    /**
     * @dev Withdraws native tokens from the sender
     * @param amount Amount of native tokens to be withdrawn
     */
    function withdraw(uint256 amount) external override {
        uint256 balance = getSmartVaultBalance[msg.sender];
        require(amount <= balance, 'RELAYER_SMART_VAULT_NO_BALANCE');
        getSmartVaultBalance[msg.sender] = balance - amount;
        emit Withdrawn(msg.sender, amount);
        (bool success, ) = payable(msg.sender).call{ value: amount }('');
        require(success, 'RELAYER_WITHDRAW_FAILED');
    }

    /**
     * @dev Executes a task
     * @param task Address of the task to execute
     * @param data Calldata to execute on the given task
     */
    function execute(address task, bytes calldata data) external override {
        __initialGas__ = gasleft();
        require(isExecutorAllowed[msg.sender], 'RELAYER_EXECUTOR_NOT_ALLOWED');

        address smartVault = ITask(task).smartVault();
        require(ISmartVault(smartVault).hasPermissions(task), 'RELAYER_INVALID_TASK_SMART_VAULT');

        // solhint-disable-next-line avoid-low-level-calls
        (bool taskSuccess, bytes memory result) = task.call(data);
        emit TaskExecuted(smartVault, task, data, taskSuccess, result);

        uint256 gasUsed = BASE_GAS + __initialGas__ - gasleft();
        uint256 totalCost = gasUsed * tx.gasprice;
        _payTransactionGasToRelayer(smartVault, totalCost);
        delete __initialGas__;

        // solhint-disable-next-line avoid-low-level-calls
        (bool paySuccess, ) = getApplicableCollector(smartVault).call{ value: totalCost }('');
        require(paySuccess, 'RELAYER_COLLECTOR_SEND_FAILED');
    }

    /**
     * @dev Withdraw ERC20 tokens to an external account. To be used in case of accidental token transfers.
     * @param token Address of the token to be withdrawn
     * @param recipient Address where the tokens will be transferred to
     * @param amount Amount of tokens to withdraw
     */
    function rescueFunds(address token, address recipient, uint256 amount) external override onlyOwner {
        require(token != address(0), 'RELAYER_EXT_WITHDRAW_TOKEN_ZERO');
        require(recipient != address(0), 'RELAYER_EXT_WITHDRAW_DEST_ZERO');
        require(amount > 0, 'RELAYER_EXT_WITHDRAW_AMOUNT_ZERO');

        IERC20(token).safeTransfer(recipient, amount);
        emit FundsRescued(token, recipient, amount);
    }

    /**
     * @dev Configures an external executor
     * @param executor Address of the executor to be set
     * @param allowed Whether the given executor should be allowed or not
     */
    function _setExecutor(address executor, bool allowed) internal {
        require(executor != address(0), 'RELAYER_EXECUTOR_ZERO');
        isExecutorAllowed[executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    /**
     * @dev Sets the default collector
     * @param collector Default fee collector to be set
     */
    function _setDefaultCollector(address collector) internal {
        require(collector != address(0), 'RELAYER_COLLECTOR_ZERO');
        defaultCollector = collector;
        emit DefaultCollectorSet(collector);
    }

    /**
     * @dev Pays transaction gas to the relayer withdrawing native tokens from a given smart vault
     * @param smartVault Address of smart vault to withdraw balance of
     * @param amount Amount of native tokens to be withdrawn
     */
    function _payTransactionGasToRelayer(address smartVault, uint256 amount) internal {
        uint256 maxQuota = getSmartVaultMaxQuota[smartVault];
        uint256 usedQuota = getSmartVaultUsedQuota[smartVault];
        uint256 availableQuota = usedQuota >= maxQuota ? 0 : (maxQuota - usedQuota);
        uint256 balance = getSmartVaultBalance[smartVault];
        require(amount <= balance + availableQuota, 'RELAYER_SMART_VAULT_NO_BALANCE');

        uint256 quota = 0;
        if (balance >= amount) {
            getSmartVaultBalance[smartVault] = balance - amount;
        } else {
            quota = amount - balance;
            getSmartVaultBalance[smartVault] = 0;
            getSmartVaultUsedQuota[smartVault] = usedQuota + quota;
        }
        emit GasPaid(smartVault, amount, quota);
    }

    /**
     * @dev Pays part of the quota for a given smart vault, if applicable
     * @param smartVault Address of smart vault to pay quota for
     * @param toDeposit Amount of native tokens to be deposited for the smart vault
     * @return quotaPaid Amount of native tokens used to pay the quota
     */
    function _payQuota(address smartVault, uint256 toDeposit) internal returns (uint256 quotaPaid) {
        uint256 usedQuota = getSmartVaultUsedQuota[smartVault];

        if (usedQuota == 0) return 0;

        if (toDeposit > usedQuota) {
            getSmartVaultUsedQuota[smartVault] = 0;
            quotaPaid = usedQuota;
        } else {
            getSmartVaultUsedQuota[smartVault] = usedQuota - toDeposit;
            quotaPaid = toDeposit;
        }
        emit QuotaPaid(smartVault, quotaPaid);
    }
}
