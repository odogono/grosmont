#!/bin/bash

mix_arg=$( cat $1 )

# node -r ts-eager/register myfile.ts
echo node -r ts-eager/register $mix_arg
node -r ts-eager/register $mix_arg

# echo npx ts-node $mix_arg
# npx ts-node $mix_arg
