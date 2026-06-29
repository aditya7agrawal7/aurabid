// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AuctionHouse is ReentrancyGuard, Ownable {

    struct Auction {
        uint256 id;
        address payable seller;
        string title;
        string description;
        uint256 startingBid;
        uint256 minimumIncrement;
        uint256 startTime;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        bool settled;
        bool cancelled;
        uint256 totalBids;
    }

    uint256 public nextAuctionId;
    uint256 public constant ANTI_SNIPE_EXTENSION = 10 minutes;
    uint256 public constant ANTI_SNIPE_THRESHOLD = 5 minutes;

    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public bidAmounts;
    mapping(uint256 => address[]) public auctionBidders;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        string title,
        uint256 startingBid,
        uint256 minimumIncrement,
        uint256 startTime,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 newEndTime
    );

    event AuctionExtended(
        uint256 indexed auctionId,
        uint256 newEndTime
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );

    event AuctionCancelled(
        uint256 indexed auctionId
    );

    event BidRefunded(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    error InvalidDuration();
    error InvalidBidAmount();
    error AuctionNotActive();
    error AuctionAlreadySettled();
    error AuctionWasCancelled();
    error BidTooLow();
    error NoBidsToRefund();
    error AlreadyHighestBidder();
    error NotSeller();
    error AuctionStillActive();
    error TransferFailed();

    modifier auctionExists(uint256 _auctionId) {
        if (auctions[_auctionId].seller == address(0)) revert AuctionNotActive();
        _;
    }

    modifier auctionActive(uint256 _auctionId) {
        Auction storage auction = auctions[_auctionId];
        if (auction.settled || auction.cancelled) revert AuctionAlreadySettled();
        if (block.timestamp < auction.startTime || block.timestamp > auction.endTime)
            revert AuctionNotActive();
        _;
    }

    constructor() Ownable(msg.sender) {}

    function createAuction(
        string calldata _title,
        string calldata _description,
        uint256 _startingBid,
        uint256 _minimumIncrement,
        uint256 _duration
    ) external returns (uint256) {
        if (_duration < 1 minutes || _duration > 30 days) revert InvalidDuration();
        if (_startingBid == 0) revert InvalidBidAmount();
        if (_minimumIncrement == 0) revert InvalidBidAmount();

        uint256 auctionId = nextAuctionId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + _duration;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: payable(msg.sender),
            title: _title,
            description: _description,
            startingBid: _startingBid,
            minimumIncrement: _minimumIncrement,
            startTime: startTime,
            endTime: endTime,
            highestBid: 0,
            highestBidder: address(0),
            settled: false,
            cancelled: false,
            totalBids: 0
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            _title,
            _startingBid,
            _minimumIncrement,
            startTime,
            endTime
        );

        return auctionId;
    }

    function placeBid(uint256 _auctionId) external payable nonReentrant auctionActive(_auctionId) {
        Auction storage auction = auctions[_auctionId];

        uint256 minBid = auction.highestBid == 0
            ? auction.startingBid
            : auction.highestBid + auction.minimumIncrement;

        if (msg.value < minBid) revert BidTooLow();
        if (msg.sender == auction.highestBidder) revert AlreadyHighestBidder();

        if (auction.highestBidder != address(0)) {
            uint256 previousBid = auction.highestBid;
            address previousBidder = auction.highestBidder;

            _removeBidder(_auctionId, previousBidder);

            auction.highestBidder = payable(address(0));
            auction.highestBid = 0;

            (bool success, ) = previousBidder.call{value: previousBid}("");
            if (!success) revert TransferFailed();

            emit BidRefunded(_auctionId, previousBidder, previousBid);
        }

        auction.highestBid = msg.value;
        auction.highestBidder = payable(msg.sender);
        auction.totalBids++;

        auctionBidders[_auctionId].push(msg.sender);
        bidAmounts[_auctionId][msg.sender] = msg.value;

        uint256 newEndTime = auction.endTime;
        if (auction.endTime - block.timestamp < ANTI_SNIPE_THRESHOLD) {
            newEndTime = block.timestamp + ANTI_SNIPE_EXTENSION;
            auction.endTime = newEndTime;
            emit AuctionExtended(_auctionId, newEndTime);
        }

        emit BidPlaced(_auctionId, msg.sender, msg.value, newEndTime);
    }

    function settleAuction(uint256 _auctionId) external nonReentrant auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];

        if (auction.settled) revert AuctionAlreadySettled();
        if (auction.cancelled) revert AuctionWasCancelled();
        if (block.timestamp < auction.endTime) revert AuctionStillActive();

        auction.settled = true;

        if (auction.highestBidder != address(0)) {
            uint256 sellerProceeds = auction.highestBid;

            (bool success, ) = auction.seller.call{value: sellerProceeds}("");
            if (!success) revert TransferFailed();

            emit AuctionSettled(_auctionId, auction.highestBidder, auction.highestBid);
        }
    }

    function claimRefund(uint256 _auctionId) external nonReentrant auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];

        if (!auction.settled && !auction.cancelled) revert AuctionStillActive();

        uint256 refundAmount = bidAmounts[_auctionId][msg.sender];
        if (refundAmount == 0) revert NoBidsToRefund();

        bidAmounts[_auctionId][msg.sender] = 0;
        _removeBidder(_auctionId, msg.sender);

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit BidRefunded(_auctionId, msg.sender, refundAmount);
    }

    function cancelAuction(uint256 _auctionId) external nonReentrant auctionExists(_auctionId) {
        Auction storage auction = auctions[_auctionId];

        if (msg.sender != auction.seller && msg.sender != owner()) revert NotSeller();
        if (auction.settled) revert AuctionAlreadySettled();

        auction.cancelled = true;

        address[] storage bidders = auctionBidders[_auctionId];
        uint256 length = bidders.length;

        for (uint256 i = 0; i < length; i++) {
            address bidder = bidders[i];
            uint256 refundAmount = bidAmounts[_auctionId][bidder];

            if (refundAmount > 0) {
                bidAmounts[_auctionId][bidder] = 0;

                (bool success, ) = bidder.call{value: refundAmount}("");
                if (!success) revert TransferFailed();

                emit BidRefunded(_auctionId, bidder, refundAmount);
            }
        }

        delete auctionBidders[_auctionId];
        emit AuctionCancelled(_auctionId);
    }

    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }

    function getAuctionBidders(uint256 _auctionId) external view returns (address[] memory) {
        return auctionBidders[_auctionId];
    }

    function getBidAmount(uint256 _auctionId, address _bidder) external view returns (uint256) {
        return bidAmounts[_auctionId][_bidder];
    }

    function getAuctionCount() external view returns (uint256) {
        return nextAuctionId;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _removeBidder(uint256 _auctionId, address _bidder) internal {
        address[] storage bidders = auctionBidders[_auctionId];
        uint256 length = bidders.length;

        for (uint256 i = 0; i < length; i++) {
            if (bidders[i] == _bidder) {
                bidders[i] = bidders[length - 1];
                bidders.pop();
                break;
            }
        }
    }

    receive() external payable {}
    fallback() external payable {}
}
