// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract ChimUpgradeableV1 is ERC20PausableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    string private constant _NAME = "Chimeras";
    string private constant _SYMBOL = "CHIM";

    uint256 private _maxTotalSupply; // max total supply

    mapping(address => bool) private _blacklistedAddresses; // blacklisted addresses

    event AddToBlacklist(address indexed account);
    event RemoveFromBlacklist(address indexed account);

    function initialize(uint256 maxTotalSupply_) initializer public {
        __ERC20_init(_NAME, _SYMBOL);
        __Ownable_init();
        __ReentrancyGuard_init();

        require(maxTotalSupply_ != 0, "CHIM: Invalid maxTotalSupply");
        _maxTotalSupply = maxTotalSupply_;
    }

    function getOwner() external view returns (address) {
        return owner();
    }

    function maxTotalSupply() external view returns (uint256) {
        return _maxTotalSupply;
    }

    function isBlacklistedAddress(address account_) external view returns (bool) {
        return _blacklistedAddresses[account_];
    }

    function transfer(
        address to_,
        uint256 amount_
    )
        public
        override
        notBlacklistedAddress(_msgSender())
        notBlacklistedAddress(to_)
        returns (bool)
    {
        return super.transfer(to_, amount_);
    }

    function transferFrom(
        address from_,
        address to_,
        uint256 amount_
    )
        public
        override
        notBlacklistedAddress(_msgSender())
        notBlacklistedAddress(from_)
        notBlacklistedAddress(to_)
        returns (bool)
    {
        return super.transferFrom(from_, to_, amount_);
    }

    function addToBlacklist(address account_) external onlyOwner {
        _blacklistedAddresses[account_] = true;
        emit AddToBlacklist(account_);
    }

    function removeFromBlacklist(address account_) external onlyOwner {
        _blacklistedAddresses[account_] = false;
        emit RemoveFromBlacklist(account_);
    }

    function mintAmount(
        address account_,
        uint256 amount_
    )
        external
        onlyOwner
        nonReentrant
        notBlacklistedAddress(account_)
    {
        require(account_ != address(0), "CHIM: Invalid address");
        _mint(account_, amount_);
        require(totalSupply() <= _maxTotalSupply, "CHIM: Max total supply limit reached");
    }

    function pauseContract() external onlyOwner {
        _pause();
    }

    function unpauseContract() external onlyOwner {
        _unpause();
    }

    modifier notBlacklistedAddress(address account_) {
        require(!_blacklistedAddresses[account_], "CHIM: Address is blacklisted");
        _;
    }
}
