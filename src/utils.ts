import { Metaplex, toMetaplexFile } from "@metaplex-foundation/js";
import {
	DataV2,
	createCreateMetadataAccountV2Instruction,
	createUpdateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";
import {
	burn,
	getMint,
	getOrCreateAssociatedTokenAccount,
	mintTo,
	transfer,
} from "@solana/spl-token";
import {
	Connection,
	Keypair,
	PublicKey,
	sendAndConfirmTransaction,
	Transaction,
} from "@solana/web3.js";
import fs from "fs";

async function createTokenAccount(
	connection: Connection,
	payer: Keypair,
	mint: PublicKey,
	owner: PublicKey
) {
	const tokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		payer,
		mint,
		owner
	);

	console.log(
		`Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
	);

	return tokenAccount;
}

async function mintTokens(
	connection: Connection,
	payer: Keypair,
	mint: PublicKey,
	destination: PublicKey,
	authority: Keypair,
	amount: number
) {
	const mintInfo = await getMint(connection, mint);

	const transactionSignature = await mintTo(
		connection,
		payer,
		mint,
		destination,
		authority,
		amount * 10 ** mintInfo.decimals
	);

	console.log(
		`Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}

async function transferTokens(
	connection: Connection,
	payer: Keypair,
	source: PublicKey,
	destination: PublicKey,
	owner: PublicKey,
	amount: number,
	mint: PublicKey
) {
	const mintInfo = await getMint(connection, mint);

	const transactionSignature = await transfer(
		connection,
		payer,
		source,
		destination,
		owner,
		amount * 10 ** mintInfo.decimals
	);

	console.log(
		`Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}

async function burnTokens(
	connection: Connection,
	payer: Keypair,
	account: PublicKey,
	mint: PublicKey,
	owner: Keypair,
	amount: number
) {
	const transactionSignature = await burn(
		connection,
		payer,
		account,
		mint,
		owner,
		amount
	);

	console.log(
		`Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}

async function createTokenMetadata(
	connection: Connection,
	metaplex: Metaplex,
	mint: PublicKey,
	user: Keypair,
	name: string,
	symbol: string,
	description: string
) {
	// file to buffer
	const buffer = fs.readFileSync("assets/logo.png");

	// buffer to metaplex file
	const file = toMetaplexFile(buffer, "logo.png");

	// upload image and get image uri
	const imageUri = await metaplex.storage().upload(file);
	console.log("image uri:", imageUri);

	// upload metadata and get metadata uri (off chain metadata)
	const { uri } = await metaplex.nfts().uploadMetadata({
		name: name,
		description: description,
		image: imageUri,
	});

	console.log("metadata uri:", uri);

	// get metadata account address
	const metadataPDA = metaplex.nfts().pdas().metadata({ mint });

	// onchain metadata format
	const tokenMetadata = {
		name: name,
		symbol: symbol,
		uri: uri,
		sellerFeeBasisPoints: 0,
		creators: null,
		collection: null,
		uses: null,
	} as DataV2;

	// transaction to create metadata account
	const transaction = new Transaction().add(
		createCreateMetadataAccountV2Instruction(
			{
				metadata: metadataPDA,
				mint: mint,
				mintAuthority: user.publicKey,
				payer: user.publicKey,
				updateAuthority: user.publicKey,
			},
			{
				createMetadataAccountArgsV2: {
					data: tokenMetadata,
					isMutable: true,
				},
			}
		)
	);

	// send transaction
	const transactionSignature = await sendAndConfirmTransaction(
		connection,
		transaction,
		[user]
	);

	console.log(
		`Create Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}

async function updateTokenMetadata(
	connection: Connection,
	metaplex: Metaplex,
	mint: PublicKey,
	user: Keypair,
	name: string,
	symbol: string,
	description: string
) {
	// file to buffer
	const buffer = fs.readFileSync("assets/logo.png");

	// buffer to metaplex file
	const file = toMetaplexFile(buffer, "logo.png");

	// upload image and get image uri
	const imageUri = await metaplex.storage().upload(file);
	console.log("image uri:", imageUri);

	// upload metadata and get metadata uri (off chain metadata)
	const { uri } = await metaplex.nfts().uploadMetadata({
		name: name,
		description: description,
		image: imageUri,
	});

	console.log("metadata uri:", uri);

	// get metadata account address
	const metadataPDA = metaplex.nfts().pdas().metadata({ mint });

	// onchain metadata format
	const tokenMetadata = {
		name: name,
		symbol: symbol,
		uri: uri,
		sellerFeeBasisPoints: 0,
		creators: null,
		collection: null,
		uses: null,
	} as DataV2;

	// transaction to update metadata account
	const transaction = new Transaction().add(
		createUpdateMetadataAccountV2Instruction(
			{
				metadata: metadataPDA,
				updateAuthority: user.publicKey,
			},
			{
				updateMetadataAccountArgsV2: {
					data: tokenMetadata,
					updateAuthority: user.publicKey,
					primarySaleHappened: true,
					isMutable: true,
				},
			}
		)
	);

	// send transaction
	const transactionSignature = await sendAndConfirmTransaction(
		connection,
		transaction,
		[user]
	);

	console.log(
		`Update Metadata Account: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
	);
}
