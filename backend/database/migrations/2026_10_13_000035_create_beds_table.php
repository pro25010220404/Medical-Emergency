<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('beds', function (Blueprint $table) {
            $table->id();
            $table->string('bed_id', 64)->unique()->comment('床位唯一业务编号');
            $table->string('label', 32)->default('')->comment('床号标签');
            $table->string('institution_id', 32);
            $table->string('department_id', 32);
            $table->unsignedTinyInteger('status')->default(0)->index()->comment('状态：0空床1占用2预留3维护');
            $table->string('patient_id', 32)->nullable();
            $table->string('reserve_reason', 128)->default('');
            $table->dateTime('reserved_until')->nullable();
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->index(['institution_id', 'department_id']);
            $table->index('patient_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('beds');
    }
};
